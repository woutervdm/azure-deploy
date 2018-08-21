# azure-deploy

Package to deploy static websites to Microsoft Azure storage.

Usage:

```bash
export AZURE_STORAGE_CONNECTION_STRING=<azure-connection-string> 
azure-deploy <source-directory>
```

The tool will sync all files in *source-directory* to the *$web* container.