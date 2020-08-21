const { loginWithServicePrincipalSecretWithAuthResponse } = require('@azure/ms-rest-nodeauth');
const { CdnManagementClient } = require('@azure/arm-cdn');

async function purgeCache() {
  const clientId = process.env.AZURE_CLIENT_ID;
  const secret = process.env.AZURE_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const profileName = process.env.AZURE_PROFILE_NAME;
  const endpointName = process.env.AZURE_ENDPOINT_NAME;

  const creds = await loginWithServicePrincipalSecretWithAuthResponse(
    clientId,
    secret,
    tenantId
  );

  const client = new CdnManagementClient(
    creds.credentials,
    subscriptionId
  );

  await client.endpoints.beginPurgeContent(
    resourceGroup,
    profileName,
    endpointName,
    ['/*']
  );
}

module.exports = {
  purgeCache
}
