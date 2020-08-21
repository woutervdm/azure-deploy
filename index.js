#!/usr/bin/env node

require('dotenv').config();

const { BlobServiceClient } = require('@azure/storage-blob');
const glob = require('glob-promise');
const _ = require('lodash');
const dayjs = require('dayjs');
const util = require('util');
const { lookup } = require('mime-types');
const { createReadStream, ...fs } = require('fs');

const { purgeCache } = require('./cdn');

const stat = util.promisify(fs.stat);

const containerName = '$web';
const source = process.argv[2];

if (!source) {
  console.error(`Usage ${process.argv[1]} <source-path>`);
  process.exit(1);
}

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  console.error(
    'Please set the environment variable AZURE_STORAGE_CONNECTION_STRING to an appropriate value');
  process.exit(2);
}

const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobService.getContainerClient(containerName);

async function listAll() {
  const result = [];

  const iter = containerClient.listBlobsFlat();
  for await (let item of iter) {
    result.push(item);
  }

  return result;
}

async function upload(source, dest) {
  const blockBlobClient =  containerClient.getBlockBlobClient(dest);

  await blockBlobClient.uploadFile(source, {
    blobHTTPHeaders: {
      blobContentType: lookup(source) || 'application/octet-stream',
      .../\.(js|css|woff|ttf|png|jpg|svg|ico)$/.exec(dest) ? { blobCacheControl: 'public,max-age=31536000' } : {}
    }
  });
}

(async () => {
  const files = await glob('**', { cwd: source, nodir: true });

  const entries = await listAll();

  const entryNames = _.map(entries, 'name');
  const entryByName = _.keyBy(entries, 'name');

  const newFiles = _.difference(files, entryNames);
  /**
   * @type {string[]}
   */
  const deletedFiles = _.difference(entryNames, files);

  const toCheck = _.intersection(files, entryNames);

  // perform date check on toCheck
  const newerFiles = [];
  for (let entry of toCheck) {
    const { mtime } = await stat(`${source}/${entry}`);

    const lastModified = dayjs(entryByName[entry].properties.lastModified);
    if (lastModified.isBefore(dayjs(mtime))) {
      newerFiles.push(entry);
    }
  }

  for (let entry of newFiles.concat(newerFiles)) {
    console.log(`Uploading ${entry}`);
    await upload(`${source}/${entry}`, entry);
  }

  for (let entry of deletedFiles) {
    console.log(`Deleting ${entry}`);
  }

  for(let i=0; i<deletedFiles.length; i+=256) {
    await blobService.getBlobBatchClient().deleteBlobs(
      deletedFiles.slice(i, i+256).map(file => containerClient.getBlobClient(file))
    );
  }

  if (process.env.AZURE_CLIENT_ID) {
    await purgeCache();
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
