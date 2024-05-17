import config = require('./config');
import util = require('util');

const emptyTreeCommit = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

const exec = util.promisify(require('child_process').exec);

interface Contributions {
    [filename: string]: {
        added: number;
        commits: number;
    };
}

async function execStdout(command: string, cwd: string, logError: boolean = true): Promise<string> {
    try {
        const {stdout, stderr} = await exec(command, { cwd });
        if (stderr && logError) {
            console.error('stderr:', stderr);
        }
        return stdout;
    } catch (err) {
        if (logError) {
            console.error('exec error:', err);
        }
        return '';
    }
}

async function getDiff(commit: string, repoPath: string): Promise<string> {
    try {
        const {stdout, stderr} = await exec(`git diff --numstat ${commit} ${commit}~1`, { cwd: repoPath });
        if (stdout) {
            return stdout;
        }
    } catch (err) {
    }

    const {stdout, stderr} = await exec(`git diff --numstat ${commit} ${emptyTreeCommit}`, { cwd: repoPath });
    return stdout;
}

async function scanRepo(repo: string): Promise<Contributions> {
    const [url, repoName] = repo.split(":");
    const repoPath = `/tmp/git_scanner/${repoName}`;
    await execStdout(`git clone ${repo}.git ${repoPath}`, '.', false);
    console.log('Cloned', repoName);
    
    const commitLog = (await execStdout(`git log --pretty=format:"%H %an"`, repoPath)).split('\n');

    const contributions: Contributions = {};

    for (const commit of commitLog) {
        const [hash, author] = commit.split(' ');
        if (author !== 'Donovan' && author !== 'doallen') {
            continue;
        }
        
        const diff = (await getDiff(hash, repoPath)).split('\n');

        const fileTypes = [];
        for (const file of diff) {
            if (!file.includes('\t')) {
                continue;
            }

            if (file.includes('=>')) {
                continue;
            }

            const [added, removed, filename] = file.split('\t');
            const fileType = filename.split('\.').pop();

            if (!contributions[fileType]) {
                contributions[fileType] = {
                    added: 0,
                    commits: 0
                };
            }
            contributions[fileType].added += parseInt(added);
            if (!fileTypes.includes(fileType)) {
                fileTypes.push(fileType);
            }
        }

        for (const fileType of fileTypes) {
            contributions[fileType].commits++;
        }
    }

    return contributions;
}

function filterContributions(contributions: Contributions, languages: string[]): Contributions {
    const filteredContributions: Contributions = {};
    for (const language of languages) {
        if (contributions[language]) {
            filteredContributions[language] = contributions[language];
        }
    }
    return filteredContributions;
}

(async () => {
    const totalContributions: Contributions = {};
    for (const repo of config.repos) {
        const contrib = await scanRepo(repo);
        for (const fileType in contrib) {
            if (!totalContributions[fileType]) {
                totalContributions[fileType] = {
                    added: 0,
                    commits: 0
                };
            }
            totalContributions[fileType].added += contrib[fileType].added;
            totalContributions[fileType].commits += contrib[fileType].commits;
        }
        console.log('Completed', repo);
    }
    const filteredContributions = filterContributions(totalContributions, config.languages);
    console.log(filteredContributions);
    const totalCommits = Object.values(filteredContributions).reduce((acc, val) => acc + val.commits, 0);
    console.log("Total commits:", totalCommits);
    const totalLines = Object.values(filteredContributions).reduce((acc, val) => acc + val.added, 0);
    console.log("Total lines:", totalLines);
})();