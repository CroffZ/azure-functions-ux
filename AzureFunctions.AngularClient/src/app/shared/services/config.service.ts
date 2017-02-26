﻿import {Http} from '@angular/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Rx';
import {Constants} from '../models/constants';

@Injectable()
export class ConfigService {
    private azureResourceManagerEndpoint: string;

    constructor(private http: Http) {
    }

    loadConfig() {
        var observable = this.http.get(Constants.serviceHost + 'api/config')
            .map<any>((response) => {
                var res = response.json();
                return res;
            });

        return observable.toPromise().then(config => this.setConfig(config));
    }

    setConfig(config: any) {
        this.azureResourceManagerEndpoint = config.AzureResourceManagerEndpoint;
    }

    getAzureResourceManagerEndpoint() {
        return this.azureResourceManagerEndpoint;
    }
}
