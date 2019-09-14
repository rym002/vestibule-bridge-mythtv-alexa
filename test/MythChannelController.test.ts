import { ChannelController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import { ChannelInfo, VideoSource } from 'mythtv-services-api';
import { createSandbox } from 'sinon';
import Handler from '../src/MythChannelController';
import { ActionMessage, createBackendNock, createFrontendNock, createMockFrontend, MockMythAlexaEventFrontend, verifyActionDirective, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';


describe('MythChannelController', function () {
    const sandbox = createSandbox()
    beforeEach(async function () {
        const frontend = await createMockFrontend('channel');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend
    })
    afterEach(function () {
        sandbox.restore()
    })

    const currentChannel: ChannelController.Channel = {
        affiliateCallSign: 'CS',
        number: '150'
    }
    function createFrontendChannelNock(frontend: MockMythAlexaEventFrontend) {
        return createFrontendNock(frontend.hostname())
            .get('/GetStatus')
            .twice()
            .reply(200, function () {
                return {
                    FrontendStatus: {
                        State: {
                            state: 'WatchingLiveTV',
                            chanid: 150
                        }
                    }
                }
            })
    }
    function createBackendChannelInfoNock() {
        return createBackendNock('Channel')
            .get('/GetChannelInfo')
            .query({
                ChanID: 150
            }).reply(200, (): { ChannelInfo: Partial<ChannelInfo> } => {
                return {
                    ChannelInfo: {
                        ChanId: 150,
                        ChanNum: currentChannel.number,
                        CallSign: currentChannel.affiliateCallSign
                    }
                }
            })
    }
    function createStateNocks(frontend: MockMythAlexaEventFrontend) {
        return [createFrontendChannelNock(frontend), createBackendChannelInfoNock()]
    }
    context('directives', function () {
        before(function () {
            const channelMock = createBackendNock('Channel')
                .get('/GetVideoSourceList')
                .reply(200, function () {
                    const sources: Partial<VideoSource>[] = [
                        {
                            Id: 1
                        },
                        {
                            Id: 2
                        }
                    ]
                    return {
                        VideoSourceList: {
                            VideoSources: sources
                        }
                    }
                }).get('/GetChannelInfoList')
                .query({
                    SourceID: 1,
                    OnlyVisible: true,
                    Details: true
                }).reply(200, function () {
                    const channelInfos: Partial<ChannelInfo>[] = [
                        {
                            ATSCMajorChan: 100,
                            ATSCMinorChan: 0,
                            CallSign: 'WAB',
                            ChannelName: 'Local Station',
                            ChanNum: '100'
                        },
                        {
                            ATSCMajorChan: 110,
                            ATSCMinorChan: 0,
                            CallSign: 'WABHD',
                            ChannelName: 'Local Station HD',
                            ChanNum: '110'
                        },
                        {
                            ATSCMajorChan: 150,
                            ATSCMinorChan: 0,
                            CallSign: 'WCB',
                            ChannelName: 'National Station',
                            ChanNum: '150'
                        },
                        {
                            ATSCMajorChan: 155,
                            ATSCMinorChan: 0,
                            CallSign: 'WCBDT',
                            ChannelName: 'National Station DT',
                            ChanNum: '155'
                        },
                        {
                            ATSCMajorChan: 180,
                            ATSCMinorChan: 0,
                            CallSign: 'WEB',
                            ChannelName: 'Test Station',
                            ChanNum: '180'
                        },
                        {
                            ATSCMajorChan: 182,
                            ATSCMinorChan: 0,
                            CallSign: 'WEBDT',
                            ChannelName: 'Test Station DT',
                            ChanNum: '182'
                        },
                        {
                            ATSCMajorChan: 185,
                            ATSCMinorChan: 0,
                            CallSign: 'WEBHD',
                            ChannelName: 'Test Station HD',
                            ChanNum: '185'
                        }
                    ]
                    return {
                        ChannelInfoList: {
                            ChannelInfos: channelInfos
                        }
                    }
                }).get('/GetChannelInfoList')
                .query({
                    SourceID: 2,
                    OnlyVisible: true,
                    Details: true
                }).reply(200, function () {
                    const channelInfos: Partial<ChannelInfo>[] = [
                        {
                            ATSCMajorChan: 200,
                            ATSCMinorChan: 0,
                            CallSign: 'KAB',
                            ChannelName: 'Test Channel Skip',
                            ChanNum: '200.0'
                        },
                        {
                            ATSCMajorChan: 200,
                            ATSCMinorChan: 1,
                            CallSign: 'KAB2',
                            ChannelName: 'Test Channel Skip 2',
                            ChanNum: '200.1'
                        }
                    ]
                    return {
                        ChannelInfoList: {
                            ChannelInfos: channelInfos
                        }
                    }
                })
        })
        function getChannelChangeActions(channelNum: string): ActionMessage[] {
            const ret: ActionMessage[] = [];
            for (const chanPart of channelNum) {
                ret.push({
                    actionName: chanPart,
                    response: true
                })
            }
            ret.push({
                actionName: 'SELECT',
                response: true
            })
            return ret;
        }
        context('ChangeChannel', function () {
            const invalidChannelError = {
                errorType: 'Alexa.Video',
                errorPayload: {
                    message: 'Invalid Channel',
                    type: 'NOT_SUBSCRIBED'
                }
            }
            beforeEach(function () {
                this.currentTest['nocks'] = createStateNocks(this.currentTest['frontend'])
            })
            context('channel.number', function () {
                it('should change to the channel number', async function () {
                    await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            number: '100'
                        }
                    }, getChannelChangeActions('100'), {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('should error on invalid channel', async function () {
                    await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            number: '900'
                        }
                    }, [], {
                        error: true,
                        payload: invalidChannelError
                    })

                })
            })
            context('channel.callSign', function () {
                it('should change to the callsign', async function () {
                    await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'KAB2'
                        }
                    }, getChannelChangeActions('200.1'), {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })

                })
                it('should prefer the hd callsign', async function () {
                    await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'WAB'
                        }
                    }, getChannelChangeActions('110'), {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('should prefer the dt callsign', async function () {
                    await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'WCB'
                        }
                    }, getChannelChangeActions('155'), {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('should prefer hd over dt', async function () {
                    await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'WEB'
                        }
                    }, getChannelChangeActions('185'), {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('should error on not found', async function () {
                    await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'BAD'
                        }
                    }, [], {
                        error: true,
                        payload: invalidChannelError
                    })
                })
            })
            context('channel.affiliateCallSign', function () {
                it('should change to the affiliateCallSign')
                it('should prefer the hd affiliateCallSign')
                it('should prefer the dt affiliateCallSign')
            })
            context('channelMetadata.name', function () {
                it('should change to the channel name', async function () {
                    await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                        },
                        channelMetadata: {
                            name: 'Test Channel Skip',
                            image: ''
                        }
                    }, getChannelChangeActions('200.0'), {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('should change to the hd channel name', async function () {
                    await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                        },
                        channelMetadata: {
                            name: 'Local Station',
                            image: ''
                        }
                    }, getChannelChangeActions('110'), {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
            })
        })
        context('SkipChannels', function () {
            beforeEach(function () {
                createStateNocks(this.currentTest['frontend'])
            })
            it('should channel up', async function () {
                await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'SkipChannels', {
                    channelCount: 2
                }, getChannelChangeActions('180'), {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('should channel down', async function () {
                await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'SkipChannels', {
                    channelCount: -2
                }, getChannelChangeActions('100'), {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('should wrap around channel up', async function () {
                await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'SkipChannels', {
                    channelCount: 16
                }, getChannelChangeActions('100'), {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('should wrap around channel down', async function () {
                await verifyActionDirective(this.test['frontend'], ChannelController.namespace, 'SkipChannels', {
                    channelCount: -12
                }, getChannelChangeActions('200.1'), {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
        })
    })
    context('MythtTV Events', function () {
        context('Start Watching', function () {
            beforeEach(function () {
                this.currentTest['nocks'] = createStateNocks(this.currentTest['frontend'])
            })
            it('PLAY_CHANGED should change state to current channel', async function () {
                await verifyMythEventState(this.test['frontend'], 'PLAY_CHANGED', {}, ChannelController.namespace, 'channel', currentChannel)
            })
            it('LIVETV_STARTED should change state to current channel', async function () {
                await verifyMythEventState(this.test['frontend'], 'LIVETV_STARTED', {}, ChannelController.namespace, 'channel', currentChannel)
            })
        })
        context('Exit Watching', function () {
            it('LIVETV_ENDED event should change state to null', async function () {
                await verifyMythEventState(this.test['frontend'], 'LIVETV_ENDED', {}, ChannelController.namespace, 'channel', null)
            })
            it('PLAY_STOPPED event should change state to null', async function () {
                await verifyMythEventState(this.test['frontend'], 'PLAY_STOPPED', {}, ChannelController.namespace, 'channel', null)
            })
        })
    })
    context('Alexa Shadow', function () {
        it('should refreshState', async function () {
            const nocks = createStateNocks(this.test['frontend'])
            await verifyRefreshState(this.test['frontend'], ChannelController.namespace, 'channel', currentChannel)
        })
        it('refreshCapability should emit powerState', async function () {
            await verifyRefreshCapability(sandbox,this.test['frontend'], false, ChannelController.namespace, ['channel'])
        })
    })
})