import { GithubScrapper } from './lib/chrome';
import fs = require('fs');
import sys = require('stream');

(async () => {
  const creds = JSON.parse(
    fs.readFileSync('cred.json').toString()
  );
  const scrapper = new GithubScrapper(creds.username, creds.password);
  await scrapper.start();

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
    console.log('Starting login task, session will be written to working/cookies.json!');
    try {
      await scrapper.login();
      await scrapper.dumpCookies('working/cookies.json');
    } catch (ex) {
      console.error('Failed to login');
      console.error(ex);
      process.exit(1);
    }
  } else {
    await scrapper.loadCookies('working/cookies.json');
  }

  let oldestYearText;
  if(startPoint === null || startPoint < 1) {
    console.log('Starting get oldest year task: resume with \`npm start -- --oldestYear\`');
    try {
      oldestYearText = await scrapper.getOldestYear();
      fs.writeFileSync('working/oldestYear.json', JSON.stringify({
        year: oldestYearText
      }));
    } catch (ex) {
      console.error('Failed to fetch oldest year');
      console.error(ex);
      console.error('Resume with \`npm start -- --oldestYear\`');
      process.exit(1);
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
    console.log('Starting repo list task: resume with \`npm start -- --getRepos\`');
    try {
      repoNames = await scrapper.getAllRepos(oldestYearText, currYear, currMonth, 'working/repos.json');
      fs.writeFileSync('working/repos.json', JSON.stringify(repoNames));
    } catch (ex) {
      console.error('Failed to collect all repos');
      console.error(ex);
      console.error('Resume with \`npm start -- --getRepos\`');
      process.exit(1);
    }
  } else {
    repoNames = scrapper.getRepoCache('working/repos.json');
  }

  const repoSet = new Set<string>();
  Object.keys(repoNames).forEach(date => {
      repoNames[date].forEach(repo => {
          repoSet.add(repo);
      });
  });

  const repos: Array<string> = [...repoSet];

  console.log('Starting repo stat task: resume with \`npm start -- --statRepos\`');
  try {
    const repoStats = await scrapper.statRepos(repos, 'working/repoStats.json');
    fs.writeFileSync('repoStats.json', JSON.stringify(repoStats));
  } catch(ex) {
    console.error('Failed to stat all repos')
    console.error(ex);
    console.error('Resume with \`npm start -- --statRepos\`');
    process.exit(1);
  }

  await scrapper.stop();

  fs.unlinkSync('working/cookies.json');

  console.log('Tool finished, output in repoStats.json')
})();
