import { GithubScrapper } from './lib/chrome';
import fs = require('fs');

(async () => {
  const creds = JSON.parse(
    fs.readFileSync('cred.json').toString()
  );
  const scrapper = new GithubScrapper(creds.username, creds.password);

  console.log();
  let startPoint = null;
  if(process.argv[2]) {
    const startName = process.argv[2].replace('--', '');
    startPoint = [
      'oldestYear',
      'getRepos',
      'statRepos'
    ].indexOf(startName);
  }

  if(startPoint === null) {
    try {
      await scrapper.login();
      await scrapper.dumpCookies('working/cookies.json');
    } catch (ex) {
      console.error('Failed to login', ex);
    }
  } else {
    await scrapper.loadCookies('working/cookies.json');
  }

  let oldestYearText;
  if(startPoint === null || startPoint < 1) {
    try {
      oldestYearText = await this.getOldestYear();
      fs.writeFileSync('working/oldestYear.json', JSON.stringify({
        year: oldestYearText
      }));
    } catch (ex) {
      console.error('Failed to fetch oldest year', ex);
      console.error('Resume with \`npm start --oldestYear\`');
    }
  } else {
    const oldestYearRaw = fs.readFileSync('working/oldestYear.json').toString();
    oldestYearText = JSON.parse(oldestYearRaw).year;
  }

  const dateObj = new Date();
  const currMonth = dateObj.getUTCMonth() + 1;
  const currYear = dateObj.getUTCFullYear();

  let repoNames;
  if(startPoint === null || startPoint < 2) {
    try {
      repoNames = await this.getAllRepos(oldestYearText, currYear, currMonth);
      fs.writeFileSync('working/repos.json', JSON.stringify(repoNames));
    } catch (ex) {
      console.error('Failed to collect all repos', ex);
      console.error('Resume with \`npm start --getRepos\`');
    }
  } else {
    repoNames = scrapper.getRepoCache();
  }

  const repoSet = new Set<string>();
  Object.keys(repoNames).forEach(date => {
      repoNames[date].forEach(repo => {
          repoSet.add(repo);
      });
  });

  const repos: Array<string> = [...repoSet];

  try {
    const repoStats = await this.statRepos(repos);
    fs.writeFileSync('working/stats.json', JSON.stringify(repoStats));
  } catch(ex) {
    console.error('Failed to stat all repos', ex);
    console.error('Resume with \`npm start --statRepos\`');
  }

  await scrapper.stop();

})();
