import { ChannelController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState } from '@vestibule-link/iot-types';
import 'mocha';
import { ApiTypes } from 'mythtv-services-api';
import Handler from '../src/MythChannelController';
import { ActionMessage, createBackendNock, createContextSandbox, createFrontendNock, createMockFrontend, getContextSandbox, getFrontend, MockMythAlexaEventFrontend, restoreSandbox, verifyActionDirective, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';


describe('MythChannelController', function () {
    beforeEach(async function () {
        createContextSandbox(this)
        createVideoSourceListMock()
        const frontend = await createMockFrontend('channel', this);
        new Handler(frontend)
        frontend.alexaEmitter.endpoint['Alexa.PlaybackStateReporter'] = {
            playbackState: 'PLAYING'
        }
        frontend.alexaEmitter.endpoint['Alexa.ChannelController'] = {
            channel: currentChannel
        }
    })
    afterEach(function () {
        restoreSandbox(this)
    })

    const currentChannel: ChannelController.Channel = {
        affiliateCallSign: 'WCB',
        number: '150'
    }
    const returnState: EndpointState = {
        'Alexa.ChannelController': {
            channel: currentChannel
        }
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
                            chanid: 1150
                        }
                    }
                }
            })
    }

    function setupWatchingTv(frontend: MockMythAlexaEventFrontend) {
        frontend.mythEventEmitter.emit('LIVETV_STARTED', {
            SENDER: ''
        })
    }
    function createVideoSourceListMock() {
        const mythNock = createBackendNock('Myth')
            .get('/GetSetting').query({
                Key: 'ChannelOrdering',
                Default: 'channum'
            }).reply(200, {
                String: 'channum'
            });
        const channelMock = createBackendNock('Channel')
            .get('/GetChannelInfoList')
            .query({
                OnlyVisible: true,
                Details: true,
                OrderByName: false
            }).reply(200, function () {
                const channelInfos: Partial<ApiTypes.ChannelInfo>[] = [
                    {
                        ATSCMajorChan: 100,
                        ATSCMinorChan: 0,
                        CallSign: 'WAB',
                        ChannelName: 'Local Station',
                        ChanNum: '100',
                        ChanId: 1100
                    },
                    {
                        ATSCMajorChan: 110,
                        ATSCMinorChan: 0,
                        CallSign: 'WABHD',
                        ChannelName: 'Local Station HD',
                        ChanNum: '110',
                        ChanId: 1110
                    },
                    {
                        ATSCMajorChan: 150,
                        ATSCMinorChan: 0,
                        CallSign: 'WCB',
                        ChannelName: 'National Station',
                        ChanNum: '150',
                        ChanId: 1150
                    },
                    {
                        ATSCMajorChan: 155,
                        ATSCMinorChan: 0,
                        CallSign: 'WCBDT',
                        ChannelName: 'National Station DT',
                        ChanNum: '155',
                        ChanId: 1155
                    },
                    {
                        ATSCMajorChan: 180,
                        ATSCMinorChan: 0,
                        CallSign: 'WEB',
                        ChannelName: 'Test Station',
                        ChanNum: '180',
                        ChanId: 1180
                    },
                    {
                        ATSCMajorChan: 182,
                        ATSCMinorChan: 0,
                        CallSign: 'WEBDT',
                        ChannelName: 'Test Station DT',
                        ChanNum: '182',
                        ChanId: 1182
                    },
                    {
                        ATSCMajorChan: 185,
                        ATSCMinorChan: 0,
                        CallSign: 'WEBHD',
                        ChannelName: 'Test Station HD',
                        ChanNum: '185',
                        ChanId: 1185
                    },
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
    }
    context('directives', function () {
        before(function () {

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
                this.currentTest['nocks'] = setupWatchingTv(getFrontend(this))
            })
            context('channel.number', function () {
                it('should change to the channel number', async function () {
                    await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            number: '100'
                        }
                    }, getChannelChangeActions('100'), {
                        error: false,
                        payload: {},
                        stateChange: returnState
                    }, returnState)
                })
                it('should error on invalid channel', async function () {
                    await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'ChangeChannel', {
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
                    await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'KAB2'
                        }
                    }, getChannelChangeActions('200.1'), {
                        error: false,
                        payload: {},
                        stateChange: returnState
                    }, returnState)

                })
                it('should prefer the hd callsign', async function () {
                    await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'WAB'
                        }
                    }, getChannelChangeActions('110'), {
                        error: false,
                        payload: {},
                        stateChange: returnState
                    }, returnState)
                })
                it('should prefer the dt callsign', async function () {
                    await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'WCB'
                        }
                    }, getChannelChangeActions('155'), {
                        error: false,
                        payload: {},
                        stateChange: returnState
                    }, returnState)
                })
                it('should prefer hd over dt', async function () {
                    await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'WEB'
                        }
                    }, getChannelChangeActions('185'), {
                        error: false,
                        payload: {},
                        stateChange: returnState
                    }, returnState)
                })
                it('should error on not found', async function () {
                    await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'ChangeChannel', {
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
                    await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                        },
                        channelMetadata: {
                            name: 'Test Channel Skip',
                            image: ''
                        }
                    }, getChannelChangeActions('200.0'), {
                        error: false,
                        payload: {},
                        stateChange: returnState
                    }, returnState)
                })
                it('should change to the hd channel name', async function () {
                    await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                        },
                        channelMetadata: {
                            name: 'Local Station',
                            image: ''
                        }
                    }, getChannelChangeActions('110'), {
                        error: false,
                        payload: {},
                        stateChange: returnState
                    }, returnState)
                })
            })
        })
        context('SkipChannels', function () {
            beforeEach(function () {
                setupWatchingTv(getFrontend(this))
            })
            it('should channel up', async function () {
                await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'SkipChannels', {
                    channelCount: 2
                }, getChannelChangeActions('180'), {
                    error: false,
                    payload: {},
                    stateChange: returnState
                }, returnState)
            })
            it('should channel down', async function () {
                await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'SkipChannels', {
                    channelCount: -2
                }, getChannelChangeActions('100'), {
                    error: false,
                    payload: {},
                    stateChange: returnState
                }, returnState)
            })
            it('should wrap around channel up', async function () {
                await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'SkipChannels', {
                    channelCount: 16
                }, getChannelChangeActions('100'), {
                    error: false,
                    payload: {},
                    stateChange: returnState
                }, returnState)
            })
            it('should wrap around channel down', async function () {
                await verifyActionDirective(getFrontend(this), ChannelController.namespace, 'SkipChannels', {
                    channelCount: -12
                }, getChannelChangeActions('200.1'), {
                    error: false,
                    payload: {},
                    stateChange: returnState
                }, returnState)
            })
        })
    })
    context('MythtTV Events', function () {
        context('Start Watching', function () {
            beforeEach(function () {
                const frontend = getFrontend(this)
                frontend.mythEventEmitter.emit('LIVETV_STARTED', {
                    SENDER: ''
                })
            })
            it('PLAY_CHANGED should change state to current channel', async function () {
                await verifyMythEventState(getFrontend(this), 'PLAY_CHANGED', {
                    SENDER: '',
                    CHANID: '1150'
                }, ChannelController.namespace, 'channel', currentChannel)
            })
        })
        context('Exit Watching', function () {
            it('LIVETV_ENDED event should change state to null', async function () {
                await verifyMythEventState(getFrontend(this), 'LIVETV_ENDED', {
                    SENDER: ''
                }, ChannelController.namespace, 'channel', null)
            })
        })
    })
    context('Alexa Shadow', function () {
        it('should refreshState', async function () {
            createFrontendChannelNock(getFrontend(this))
            await (<any>getFrontend(this)).initFromState()
            await verifyRefreshState(getFrontend(this), ChannelController.namespace, 'channel', currentChannel)
        })
        it('refreshCapability should emit powerState', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, ChannelController.namespace, ['channel'])
        })
    })
})