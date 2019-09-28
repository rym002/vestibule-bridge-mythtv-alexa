import 'mocha'
import * as nock from 'nock';
import { loadFrontends } from '@vestibule-link/bridge-mythtv/dist/frontends'
import { registerAssistant } from '@vestibule-link/bridge-assistant-alexa/dist/endpoint'
import { registerFrontends, MANUFACTURER_NAME } from '../src/Frontend'
import { providersEmitter } from '@vestibule-link/bridge-assistant';
import { expect } from 'chai'
import { createSandbox } from 'sinon';
import * as nodeArp from 'node-arp';

describe('Frontend', () => {
    const sandbox = createSandbox()
    after(() => {
        sandbox.restore()
    })
    before(async () => {
        sandbox.stub(nodeArp, 'getMAC')
        const mythNock = nock("http://localhost:6544/Myth")
            .get('/GetFrontends')
            .query({
                OnLine: false
            })
            .reply(200, {
                FrontendList: {
                    Frontends: [
                        {
                            Name: "hostgood",
                            IP: "hostgood",
                            Port: "6547",
                            OnLine: "1"
                        }, {
                            Name: "hostbad",
                            IP: "hostbad",
                            Port: "6547",
                            OnLine: "1"
                        }]
                }
            })
            .get('/GetSetting').query({
                Key: 'AlexaEnabled',
                HostName: 'hostgood',
                Default: 'true'
            }).reply(200, {
                String: 'true'
            })
            .get('/GetSetting').query({
                Key: 'AlexaEnabled',
                HostName: 'hostbad',
                Default: 'true'
            }).reply(200, {
                String: 'false'
            })
            .get('/GetSetting').query({
                Key: 'AlexaFriendlyName',
                HostName: 'hostgood',
                Default: 'hostgood'
            })
            .reply(200, {
                String: 'hostgood desc'
            })
            .get('/GetSetting').query({
                Key: 'NetworkControlEnabled',
                HostName: 'hostgood'
            }).reply(200, {
                String: '2'
            })

        const feNock = nock('http://hostgood:6547/Frontend')
            .get('/GetStatus').thrice().reply(200, {
                FrontendStatus: {
                    State: {
                        state: 'WatchingLiveTV'
                    }
                }
            })
    })

    it('should create', async () => {
        registerAssistant()
        await loadFrontends();
        await registerFrontends()
        const good = providersEmitter.getEndpointEmitter('alexa', {
            provider: MANUFACTURER_NAME,
            host: 'hostgood'
        }, false)
        const bad = providersEmitter.getEndpointEmitter('alexa', {
            provider: MANUFACTURER_NAME,
            host: 'hostbad'
        }, false)
        expect(good).to.not.be.undefined
        expect(bad).to.be.undefined
    })
})
