import 'mocha'
import * as nock from 'nock';
import { loadFrontends } from '@vestibule-link/bridge-mythtv/dist/frontends'
import { registerAssistant } from '@vestibule-link/bridge-assistant-alexa/dist/endpoint'
import { registerFrontends } from '../src/Frontend'

describe('Frontend', () => {
    const nocks: nock.Scope[] = []
    after(() => {
        nocks.forEach(anock=>{
            anock.restore()
        })
    })
    before(async () => {
        registerAssistant()
        const mythNock = nock("http://localhost:6544/Myth")
            .get('/GetHosts').reply(200, () => {
                return {
                    StringList: [
                        "hostgood",
                        "hostbad"
                    ]
                };
            }).get('/GetSetting').query({
                Key: 'AlexaEnabled',
                HostName: 'hostgood',
                Default: 'true'
            }).reply(200, () => {
                return {
                    String: 'true'
                };
            }).get('/GetSetting').query({
                Key: 'AlexaFriendlyName',
                HostName: 'hostgood',
                Default: 'hostgood'
            }).reply(200, () => {
                return {
                    String: 'hostgood desc'
                };
            }).get('/GetSetting').query({
                Key: 'FrontendStatusPort',
                HostName: 'hostbad',
                Default: '6547'
            }).reply(200, () => {
                return {
                    String: '6547'
                };
            }).get('/GetSetting').query({
                Key: 'NetworkControlEnabled',
                HostName: 'hostgood'
            }).reply(200, () => {
                return {
                    String: '2'
                };
            }).get('/GetSetting').query({
                Key: 'FrontendStatusPort',
                HostName: 'hostgood',
                Default: '6547'
            }).reply(200, () => {
                return {
                    String: '6547'
                };
            }).get('/GetSetting').query({
                Key: 'Theme',
                HostName: 'hostbad'
            }).reply(200, () => {
                return {
                    String: undefined
                };
            }).get('/GetSetting').query({
                Key: 'Theme',
                HostName: 'hostgood'
            }).reply(200, () => {
                return {
                    String: 'goof'
                };
            });
        nocks.push(mythNock)

        // const dvrNock = nock('http://localhost:6544/Dvr').get("/GetEncoderList").reply(200, () => {
        //     return {
        //         EncoderList: {
        //             Encoders: [{
        //                 Id: 1
        //             }]
        //         }
        //     }
        // });
        // nocks.push(dvrNock)

        const feNock = nock('http://hostgood:6547/Frontend')
            .get('/GetStatus').thrice().reply(200, () => {
                return {
                    FrontendStatus: {
                        State: {
                            state: 'WatchingLiveTV'
                        }
                    }
                }
            })
        nocks.push(feNock)
        await loadFrontends();
    })

    it('should create', async () => {
        await registerFrontends()

    })
})
