import { ChannelController } from '@vestibule-link/alexa-video-skill-types';
import { ChannelLookup } from '@vestibule-link/bridge-mythtv';
import { EndpointState } from '@vestibule-link/iot-types';
import 'mocha';
import Handler from '../src/MythChannelController';
import { ActionMessage, createBackendNock, createFrontendNock, createMockFrontend, getConnectionHandlerStub, getContextSandbox, getFrontend, getTopicHandlerMap, MockMythAlexaEventFrontend, verifyActionDirective, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';


describe('MythChannelController', function () {
    beforeEach(async function () {
        createVideoSourceListMock()
        const frontend = await createMockFrontend('channel', this);
        const handler = new Handler(frontend)
        await handler.register()
        frontend.alexaConnector.reportedState['Alexa.PlaybackStateReporter'] = {
            playbackState: {
                state: 'PLAYING'
            }
        }
        frontend.alexaConnector.reportedState['Alexa.ChannelController'] = {
            channel: currentChannel
        }
    })

    const currentChannel: ChannelController.Channel = {
        callSign: 'WCB',
        number: '150',
        affiliateCallSign: 'AF1'
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

    function stubCurrentChannelInfo(context: Mocha.Context) {
        const sandbox = getContextSandbox(context)
        sandbox.stub(ChannelLookup.prototype, 'getChannelInfoForChanId').withArgs(1150).returns({
            CallSign: currentChannel.callSign,
            affiliateName: currentChannel.affiliateCallSign,
            ChanNum: currentChannel.number,
            ChanId: 1,
            ChannelName: '',
            IconURL: '',
            Programs: []
        })

    }

    function setupWatchingTv(frontend: MockMythAlexaEventFrontend) {
        frontend.mythEventEmitter.emit('LIVETV_STARTED', {
            SENDER: ''
        })
    }
    function createVideoSourceListMock() {
        const mythNock = createBackendNock('Myth')
            .get('/GetHostName')
            .reply(200, {
                String: 'hostgood'
            })
            .get('/GetSetting').query({
                Key: 'ChannelOrdering',
                Default: 'channum'
            }).reply(200, {
                String: 'channum'
            });
        const channelMock = createBackendNock('Channel')
            .get('/GetVideoSourceList')
            .reply(200, {
                VideoSourceList: {
                    VideoSources: [
                        {
                            Grabber: ''
                        }
                    ]
                }
            })
            .get('/GetChannelInfoList')
            .query({
                OnlyVisible: true,
                Details: true,
                OrderByName: false
            }).reply(200, {
                ChannelInfoList: {
                    ChannelInfos: []
                }
            })
    }
    context('directives', function () {
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
                    const sandbox = getContextSandbox(this)
                    sandbox.stub(ChannelLookup.prototype, 'isValidChanNum').withArgs('100').returns(true)
                    await verifyActionDirective(getFrontend(this),
                        getConnectionHandlerStub(this),
                        getTopicHandlerMap(this),
                        ChannelController.namespace, 'ChangeChannel', {
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
                    await verifyActionDirective(getFrontend(this),
                        getConnectionHandlerStub(this),
                        getTopicHandlerMap(this),
                        ChannelController.namespace, 'ChangeChannel', {
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
                    const sandbox = getContextSandbox(this)
                    sandbox.stub(ChannelLookup.prototype, 'searchCallSign').withArgs('KAB2').returns('200.1')
                    await verifyActionDirective(getFrontend(this),
                        getConnectionHandlerStub(this),
                        getTopicHandlerMap(this),
                        ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            callSign: 'KAB2'
                        }
                    }, getChannelChangeActions('200.1'), {
                        error: false,
                        payload: {},
                        stateChange: returnState
                    }, returnState)

                })
            })
            context('channel.affiliateCallSign', function () {
                it('should change to the affiliateCallSign', async function () {
                    const sandbox = getContextSandbox(this)
                    sandbox.stub(ChannelLookup.prototype, 'searchAffiliate').withArgs('AFF1').returns('300')
                    await verifyActionDirective(getFrontend(this),
                        getConnectionHandlerStub(this),
                        getTopicHandlerMap(this),
                        ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                            affiliateCallSign: 'AFF1'
                        }
                    }, getChannelChangeActions('300'), {
                        error: false,
                        payload: {},
                        stateChange: returnState
                    }, returnState)

                })
            })
            context('channelMetadata.name', function () {
                it('should change to the channel name', async function () {
                    const sandbox = getContextSandbox(this)
                    sandbox.stub(ChannelLookup.prototype, 'searchChannelName').withArgs('Test Channel Skip').returns('400')
                    await verifyActionDirective(getFrontend(this),
                        getConnectionHandlerStub(this),
                        getTopicHandlerMap(this),
                        ChannelController.namespace, 'ChangeChannel', {
                        channel: {
                        },
                        channelMetadata: {
                            name: 'Test Channel Skip',
                            image: ''
                        }
                    }, getChannelChangeActions('400'), {
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
            it('should skip channel', async function () {
                const sandbox = getContextSandbox(this)
                sandbox.stub(ChannelLookup.prototype, 'getSkipChannelNum').withArgs('150', 2).returns('400')
                await verifyActionDirective(getFrontend(this),
                    getConnectionHandlerStub(this),
                    getTopicHandlerMap(this),
                    ChannelController.namespace, 'SkipChannels', {
                    channelCount: 2
                }, getChannelChangeActions('400'), {
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
                stubCurrentChannelInfo(this)
                await verifyMythEventState(getContextSandbox(this),
                    getFrontend(this), 'PLAY_CHANGED', {
                    SENDER: '',
                    CHANID: '1150'
                }, ChannelController.namespace, 'channel', currentChannel)
            })
        })
        context('Exit Watching', function () {
            it('LIVETV_ENDED event should change state to null', async function () {
                await verifyMythEventState(getContextSandbox(this),
                    getFrontend(this), 'LIVETV_ENDED', {
                    SENDER: ''
                }, ChannelController.namespace, 'channel', {
                    affiliateCallSign: null,
                    callSign: null,
                    number: null
                })
            })
        })
    })
    context('Alexa Shadow', function () {
        it('should refreshState', async function () {
            stubCurrentChannelInfo(this)
            createFrontendChannelNock(getFrontend(this))
            await (<any>getFrontend(this)).initFromState()
            await verifyRefreshState(getContextSandbox(this), getFrontend(this), ChannelController.namespace, 'channel', currentChannel)
        })
        it('refreshCapability should emit powerState', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, ChannelController.namespace, ['channel'])
        })
    })
})