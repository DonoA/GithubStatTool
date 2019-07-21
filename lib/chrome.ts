import puppeteer = require('puppeteer');
import fs = require('fs');
import { asyncForEach, asyncMap } from './util';

const monthList = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

class RepoLineStats {
    commits: number;
    additions: number; 
    deletions: number;

    constructor(commits: number, additions: number, deletions: number) {
        this.commits = commits;
        this.additions = additions;
        this.deletions = deletions;
    }
}

export class GithubScrapper {
    private username: string;
    private password: string;

    private browser: puppeteer.Browser;
    private page: puppeteer.Page;

    constructor(username: string, password: string) {
        this.username = username;
        this.password = password;
    }

    async start() {
        this.browser = await puppeteer.launch({
            headless: true,
            
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({width: 1400, height: 1000});
    }

    async stop() {
        await this.browser.close();
    }

    async login() {
        await this.page.goto('https://github.com/login');
    
        await this.page.waitForXPath('/html/body/div[3]/main/div/form/div[3]/input[4]');
    
        const username = await this.page.mainFrame().$x('//*[@id="login_field"]');
        const password = await this.page.mainFrame().$x('//*[@id="password"]');
        const submit = await this.page.mainFrame().$x('/html/body/div[3]/main/div/form/div[3]/input[4]');
    
        await username[0].type(this.username);
        await password[0].type(this.password);
    
        await submit[0].click();
    
        await this.page.waitForXPath('/html/body/div[1]/header/div[8]/details');
    };

    async dumpCookies(location: string) {
        const cookies = await this.page.cookies();
        fs.writeFileSync(location, JSON.stringify(cookies));
    };
    
    async loadCookies(location: string) {
        const cookies: Array<puppeteer.Cookie> = JSON.parse(fs.readFileSync(location).toString());
        await asyncForEach(cookies, async (cookie: puppeteer.Cookie) => {
            await this.page.setCookie(cookie);
        });
    };

    async getOldestYear(): Promise<number> {
        await this.page.goto(`https://github.com/${this.username}`);

        const years = await this.page.mainFrame().$x('/html/body/div[4]/main/div/div[3]/div[3]/div[2]/div/div[2]/div/div[2]/ul/li');
    
        const oldest = years.reverse()[0];
        const oldestText = await this.getText(oldest);
    
        return parseInt(oldestText);
    };

    async getAllRepos(startYear: number, endYear: number, endMonth: number, cacheLocation: string): Promise<object> {
        let allRepos = {};
    
        if(fs.existsSync(cacheLocation)) {
            allRepos = JSON.parse(fs.readFileSync(cacheLocation).toString());
        }

        for (let year = startYear; year <= endYear; year++) {
            const finalMonth = (year === endYear ? endMonth : 12);
            for (let month = 1; month <= finalMonth; month++) {
                if(allRepos[`${year.toString()}-${month}`] !== undefined) {
                    continue;
                }

                const monthPad = month.toString().padStart(2, '0');
                await this.page.goto(`https://github.com/${this.username}?tab=overview&from=${year}-${monthPad}-01&to=${year}-${monthPad}-31`);
        
                const dateHeader = await this.page.mainFrame().$x('/html/body/div[4]/main/div/div[3]/div[3]/div[2]/div/div[1]/div[2]/div/div/h3');
                while(true) {
                    const headerText = await this.getText(dateHeader[0]);
                    if(headerText.includes(monthList[month - 1])) {
                        break;
                    }
                }
            
                const commitRepos = await this.page.mainFrame().$x('/html/body/div[4]/main/div/div[3]/div[3]/div[2]/div/div[1]/div[2]/div/div/div[1]/ul/li/div[1]/a[1]');
                const repos = await asyncMap(commitRepos, async (repo) => await this.getText(repo));
                allRepos[`${year.toString()}-${month}`] = repos;
                fs.writeFileSync(cacheLocation, JSON.stringify(allRepos));
            }
        }
    
        return allRepos;
    }

    getRepoCache(cacheLocation: string): object {
        return JSON.parse(fs.readFileSync(cacheLocation).toString());
    }

    async statRepos(repos: Array<string>, cacheLocation: string): Promise<object> {
        let repoStats = {};
        if(fs.existsSync(cacheLocation)) {
            repoStats = JSON.parse(fs.readFileSync(cacheLocation).toString());
        }
        
        repos = repos.filter(repo => repoStats[repo] === undefined);

        await asyncForEach(repos, async (repo) => {
            const stats = await this.getRepoLineStats(repo);
            const langStats = await this.getRepoLangStats(repo);
            repoStats[repo] = {
                raw: stats,
                langDiv: langStats
            };
            fs.writeFileSync(cacheLocation, JSON.stringify(repoStats));
        });

        return repoStats;
    }

    async getRepoLineStats(repo: string): Promise<RepoLineStats> {
        await this.page.goto(`https://github.com/${repo}/graphs/contributors`);
        try {
            await this.page.waitForXPath('//*[@id="contributors"]/ol/li/span/h3/span[1]');
        } catch(ex) {
            const errorElt = (await this.page.mainFrame().$x('/html/body/div[4]/div/main/div[2]/div[1]/div/div[2]/div[2]/div[2]/div[2]/p'));
            if(errorElt.length !== 0) {
                console.error('Github rate limit reached, try starting again in 10 min');
            }
            throw ex;
        }
        const statBoxArr = (await this.page.mainFrame().$x(`//a[@href=\'/${this.username}\' and @class=\'text-normal\']/..`));
        if(statBoxArr.length === 0) {
            console.log('failed to stat', repo);
            return new RepoLineStats(0,0,0);
        }
        const statBox = statBoxArr[0];
        const commitStat = (await statBox.$x('span[2]/span/a'))[0];
        const addStat = (await statBox.$x('span[2]/span/span[1]'))[0];
        const delStat = (await statBox.$x('span[2]/span/span[2]'))[0];
    
        const commits = parseInt((await this.getText(commitStat)).replace('commits', '').replace(/,/g, '').trim());
        const additions = parseInt((await this.getText(addStat)).replace('++', '').replace(/,/g, '').trim());
        const deletions = parseInt((await this.getText(delStat)).replace('--', '').replace(/,/g, '').trim());
    
        return new RepoLineStats(commits, additions, deletions);
    }

    async getRepoLangStats(repo: string): Promise<object> {
        await this.page.goto(`https://github.com/${repo}`);
        const langBar = (await this.page.mainFrame().$x('/html/body/div[4]/div/main/div[2]/div[1]/button/span'));
        const langStats = {};
        await asyncForEach(langBar, async (lang) => {
            const stat: string =  await this.page.evaluate(element => element.getAttribute('aria-label'), lang);
            const [name, val] = stat.split(' ');
            langStats[name] = val;
        });
        return langStats;
    }

    private async getText(elt: puppeteer.ElementHandle): Promise<string> {
        return await this.page.evaluate(element => element.textContent.trim(), elt);
    }
}
