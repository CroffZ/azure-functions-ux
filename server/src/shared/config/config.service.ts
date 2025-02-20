import { Injectable, OnModuleInit } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AcrSuffix, CloudArmEndpoints, Constants } from '../../constants';
import { HttpService } from '../../shared/http/http.service';
import { CloudType, StaticAngularConfig, StaticReactConfig } from '../../types/config';
export const KeyvaultApiVersion = '2016-10-01';
export const KeyvaultUri = 'https://vault.azure.net';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly dotEnvConfig: dotenv.DotenvParseOutput;

  constructor(private httpService: HttpService) {
    this.dotEnvConfig = dotenv.config().parsed || {};
  }

  async onModuleInit() {
    await this.loadConfig();
  }
  get(key: string): string {
    if (key === 'ARM_ENDPOINT') {
      return 'https://management.azure.com';
    }
    return process.env[key];
  }

  get staticAngularConfig(): StaticAngularConfig {
    return {
      config: {
        env: {
          runtimeType: 'Azure',
          hostName: process.env.WEBSITE_HOSTNAME,
          azureResourceManagerEndpoint: 'https://management.azure.com',
          appName: process.env.WEBSITE_SITE_NAME,
        },
        version: process.env.VERSION,
        cacheBreakQuery: process.env.CACHE_BREAK_QUERY,
        isAzure: !!process.env.WEBSITE_SITE_NAME,
        functionsVersionInfo: {
          runtimeStable: ['~1', 'beta', '~2', 'latest', '~3'],
          runtimeDefault: '~1',
        },
      },
    };
  }

  get staticReactConfig(): StaticReactConfig {
    const acceptedOriginsString = process.env.APPSVC_ACCEPTED_ORIGINS_SUFFIX;
    let acceptedOrigins: string[] = [];
    if (acceptedOriginsString) {
      acceptedOrigins = acceptedOriginsString.split(',');
    }

    return {
      env: {
        appName: process.env.WEBSITE_SITE_NAME,
        hostName: process.env.WEBSITE_HOSTNAME,
        cloud: process.env.APPSVC_CLOUD as CloudType,
        acceptedOriginsSuffix: acceptedOrigins,
      },
      version: process.env.VERSION,
    };
  }

  get endpointSuffix(): string {
    const config = this.staticReactConfig;
    if (config.env && config.env.cloud) {
      switch (config.env.cloud) {
        case CloudType.fairfax:
          return Constants.endpointSuffix.farifax;
        case CloudType.mooncake:
          return Constants.endpointSuffix.mooncake;
        case CloudType.usnat:
          return Constants.endpointSuffix.usnat;

        // NOTE (krmitta): For all the other cases we are returning the public endpoint
        case CloudType.onprem: // falls through
        case CloudType.public: // falls through
        default:
          return Constants.endpointSuffix.public;
      }
    } else {
      return Constants.endpointSuffix.public;
    }
  }

  get armEndpoint(): string {
    const config = this.staticReactConfig;
    if (config.env && config.env.cloud) {
      switch (config.env.cloud) {
        case CloudType.fairfax:
          return CloudArmEndpoints.fairfax;
        case CloudType.mooncake:
          return CloudArmEndpoints.mooncake;
        case CloudType.usnat:
          return CloudArmEndpoints.usnat;
        case CloudType.ussec:
          return CloudArmEndpoints.ussec;
        // NOTE (krmitta): For all the other cases we are returning the public endpoint
        case CloudType.onprem: // falls through
        case CloudType.public: // falls through
        default:
          return CloudArmEndpoints.public;
      }
    } else {
      return CloudArmEndpoints.public;
    }
  }

  get acrSuffix(): string {
    const config = this.staticReactConfig;
    if (config.env && config.env.cloud) {
      switch (config.env.cloud) {
        case CloudType.fairfax:
          return AcrSuffix.fairfax;
        case CloudType.mooncake:
          return AcrSuffix.mooncake;
        case CloudType.usnat:
          return AcrSuffix.usnat;
        case CloudType.ussec:
          return AcrSuffix.ussec;
        case CloudType.onprem: // falls through
        case CloudType.public: // falls through
        default:
          return AcrSuffix.public;
      }
    } else {
      return AcrSuffix.public;
    }
  }

  private async getAADTokenFromMSI(endpoint: string, secret: string, resource: string) {
    const apiVersion = '2017-09-01';

    try {
      const response = await this.httpService.get(`${endpoint}/?resource=${resource}&api-version=${apiVersion}`, {
        headers: {
          Secret: secret,
        },
      });
      return response.data.access_token;
    } catch (err) {
      return null;
    }
  }

  private async loadConfig(props: any = {}) {
    const { aadAccessToken } = props;

    let aadToken;
    if (!aadAccessToken) {
      // no token - get one using Managed Service Identity inside process.env
      const resource = KeyvaultUri;
      if (process.env.MSI_ENDPOINT && process.env.MSI_SECRET) {
        aadToken = await this.getAADTokenFromMSI(process.env.MSI_ENDPOINT as string, process.env.MSI_SECRET as string, resource);
      } else {
        aadToken = null;
      }
    } else if (typeof aadAccessToken === 'string') {
      aadToken = aadAccessToken;
    }

    const envWithKeyvault = Object.assign({}, this.dotEnvConfig);
    const token = aadToken;

    if (token) {
      // This will find all dotnetEnv defined values that match the pattern kv:<secret url> and fetches the true value from keyvault
      const fetches = Object.keys(this.dotEnvConfig)
        .filter(key => this.dotEnvConfig[key].match(/^kv:/))
        .map(async key => {
          const uri = `${this.dotEnvConfig[key].replace(/^kv:/, '')}?api-version=${KeyvaultApiVersion}`;
          try {
            const secretResponse = await this.httpService.get(uri, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            envWithKeyvault[key] = secretResponse.data.value;
          } catch (err) {
            console.log(err);
          }
        });
      await Promise.all(fetches);
    }
    process.env = Object.assign(process.env, envWithKeyvault);
  }
}
