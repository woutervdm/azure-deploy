#!/usr/bin/env node

require('dotenv').config();

const azure = require('azure-storage');
const glob = require('glob-promise');
const _ = require('lodash');
const moment = require('moment');
const util = require('util');
const fs = require('fs');

const stat = util.promisify(fs.stat);

const blobService = azure.createBlobService();

const containerName = '$web';
const source = process.argv[2];

if (!source) {
  console.error(`Usage ${process.argv[1]} <source-path>`);
  process.exit(1);
}

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  console.error('Please set the environment variable AZURE_STORAGE_CONNECTION_STRING to an appropriate value');
  process.exit(2);
}

const list = continuationToken => new Promise((accept, reject) => {
  blobService.listBlobsSegmented(containerName, continuationToken, (err, data) => {
    if (err) {
      reject(err);
    } else {
      accept(data);
    }
  });
});

const listAll = async () => {
  let result = [];

  let response = null;

  do {
    response = await list(response ? response.continuationToken : null);
    result = result.concat(response.entries);
  } while(response.continuationToken);

  return result;
};

const upload = async (source, dest) => new Promise((accept, reject) => {
  blobService.createBlockBlobFromLocalFile(containerName, dest, source, {
    .../\.(js|css|woff|ttf|png|jpg|svg)$/.exec(dest) ? {contentSettings: {
      cacheControl: 'public,max-age=31536000'
    }} : {}
  }, err => {
    if (err) {
      reject(err);
    }
    else {
      accept();
    }
  })
});

const remove = async blobName => new Promise((accept, reject) => {
  blobService.deleteBlobIfExists(containerName, blobName, err => {
    if (err) {
      reject(err);
    } else {
      accept();
    }
  });
});

(async () => {
  const files = await glob('**', {cwd: source, nodir: true});

  const entries = await listAll();

  const entryNames = _.map(entries, 'name');
  const entryByName = _.keyBy(entries, 'name');

  const newFiles = _.difference(files, entryNames);
  const deletedFiles = _.difference(entryNames, files);

  const toCheck = _.intersection(files, entryNames);

  // perform date check on toCheck
  const newerFiles = [];
  for(let entry of toCheck) {
    const {mtime} = await stat(`${source}/${entry}`);

    const lastModified = moment(entryByName[entry].lastModified);
    if (lastModified < moment(mtime)) {
      newerFiles.push(entry);
    }
  }

  for(let entry of newFiles.concat(newerFiles)) {
    console.log(`Uploading ${entry}`);
    await upload(`${source}/${entry}`, entry);
  }

  for(let entry of deletedFiles) {
    console.log(`Deleting ${entry}`);
    await remove(entry);
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
