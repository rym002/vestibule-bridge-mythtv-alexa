import { providersEmitter } from '@vestibule-link/bridge-assistant';
import { loadFrontends } from '@vestibule-link/bridge-mythtv/dist/frontends';
import { expect } from 'chai';
import 'mocha';
import * as nock from 'nock';
import * as nodeArp from 'node-arp';
import { getEndpointNameFromHostname, registerFrontends } from '../src/Frontend';
import { createContextSandbox, initAssistant, restoreSandbox } from './MockHelper';
describe('Frontend', () => {
    after(function () {
        restoreSandbox(this)
    })
    before(async function () {
        const sandbox = createContextSandbox(this)
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
            .get('/GetHostName')
            .reply(200, {
                String: 'hostbackend'
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
        await initAssistant()
        await loadFrontends();
        await registerFrontends()
        const good = await providersEmitter.getEndpointEmitter('alexa', getEndpointNameFromHostname('hostgood'), false)
        const bad = await providersEmitter.getEndpointEmitter('alexa', getEndpointNameFromHostname('hostbad'), false)
        expect(good).to.not.be.undefined
        expect(bad).to.be.undefined
    })
})
