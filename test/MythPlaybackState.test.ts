import { PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import Handler from '../src/MythPlaybackState';
import { createFrontendNock, createMockFrontend, getConnectionHandlerStub, getContextSandbox, getFrontend, getTopicHandlerMap, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';

describe('MythPlaybackState', function () {
    beforeEach(async function () {
        const frontend = await createMockFrontend('playbackstate', this);
        frontend.mythEventEmitter.emit('PLAY_STARTED', {
            SENDER: ''
        })
        const handler = new Handler(frontend)
        await handler.register()
    })
    context('MythtTV Events', function () {
        it('PLAY_CHANGED event should change state to PLAYING', async function () {
            await verifyMythEventState(getContextSandbox(this),
                getFrontend(this), 'PLAY_CHANGED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'PLAYING' },
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this))
        })
        it('PLAY_STARTED event should change state to PLAYING', async function () {
            await verifyMythEventState(getContextSandbox(this),
                getFrontend(this), 'PLAY_STARTED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'PLAYING' },
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this))
        })
        it('PLAY_UNPAUSED event should change state to PLAYING', async function () {
            await verifyMythEventState(getContextSandbox(this),
                getFrontend(this), 'PLAY_UNPAUSED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'PLAYING' },
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this))
        })
        it('PLAY_PAUSED event should change state to PAUSED', async function () {
            await verifyMythEventState(getContextSandbox(this),
                getFrontend(this), 'PLAY_PAUSED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'PAUSED' },
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this))
        })
        it('PLAY_STOPPED event should change state to STOPPED', async function () {
            await verifyMythEventState(getContextSandbox(this),
                getFrontend(this), 'PLAY_STOPPED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'STOPPED' },
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this))
        })
    })
    context('Alexa Shadow', function () {
        context('refreshState', function () {
            context('watching', function () {
                beforeEach(function () {
                    const frontend = getFrontend(this)
                    frontend.mythEventEmitter.emit('PLAY_STARTED', {
                        SENDER: ''
                    })
                })
                it('should emit PAUSED when watching and playspeed is 0', async function () {
                    const feNock = createFrontendNock(getFrontend(this).hostname())
                        .get('/GetStatus')
                        .twice()
                        .reply(200, function () {
                            return {
                                FrontendStatus: {
                                    State: {
                                        state: 'WatchingTv',
                                        playspeed: 0
                                    }
                                }
                            }
                        })
                    await verifyRefreshState(getContextSandbox(this),
                        getFrontend(this), PlaybackStateReporter.namespace, 'playbackState', { state: 'PAUSED' },
                        getConnectionHandlerStub(this),
                        getTopicHandlerMap(this))
                })
                it('should emit PLAYING when watching and playspeed != 0', async function () {
                    const feNock = createFrontendNock(getFrontend(this).hostname())
                        .get('/GetStatus')
                        .twice()
                        .reply(200, function () {
                            return {
                                FrontendStatus: {
                                    State: {
                                        state: 'WatchingSomething',
                                        playspeed: 1
                                    }
                                }
                            }
                        })
                    await verifyRefreshState(getContextSandbox(this),
                        getFrontend(this), PlaybackStateReporter.namespace, 'playbackState', { state: 'PLAYING' },
                        getConnectionHandlerStub(this),
                        getTopicHandlerMap(this))
                })
            })
            context('Not watching', function () {
                beforeEach(function () {
                    const frontend = getFrontend(this)
                    frontend.mythEventEmitter.emit('PLAY_STOPPED', {
                        SENDER: ''
                    })
                })
                it('should emit STOPPED when not watching', async function () {
                    await verifyRefreshState(getContextSandbox(this),
                        getFrontend(this), PlaybackStateReporter.namespace, 'playbackState', { state: 'STOPPED' },
                        getConnectionHandlerStub(this),
                        getTopicHandlerMap(this))
                })
            })
        })
        it('refreshCapability should emit playbackState', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, PlaybackStateReporter.namespace, ['playbackState'])
        })
    })
})