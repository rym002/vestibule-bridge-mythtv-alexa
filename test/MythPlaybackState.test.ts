import { PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythPlaybackState';
import { createFrontendNock, createMockFrontend, MockMythAlexaEventFrontend, verifyRefreshCapability, verifyRefreshState, verifyState } from './MockHelper';

describe('MythPlaybackState', () => {
    const sandbox = createSandbox()
    let frontend: MockMythAlexaEventFrontend
    let handler: Handler
    before(async () => {
        frontend = await createMockFrontend('playbackstate');
        handler = new Handler(frontend)
    })
    afterEach(() => {
        sandbox.restore()
        frontend.resetDeltaId()
    })
    context('MythtTV Events', () => {
        afterEach(() => {
            sandbox.restore()
            frontend.resetDeltaId()
        })
        it('LIVETV_STARTED event should change state to PLAYING', async () => {
            await verifyState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'PLAYING', () => {
                frontend.mythEventEmitter.emit('LIVETV_STARTED', {})
            })
        })
        it('PLAY_CHANGED event should change state to PLAYING', async () => {
            await verifyState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'PLAYING', () => {
                frontend.mythEventEmitter.emit('PLAY_CHANGED', {})
            })
        })
        it('PLAY_STARTED event should change state to PLAYING', async () => {
            await verifyState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'PLAYING', () => {
                frontend.mythEventEmitter.emit('PLAY_STARTED', {})
            })
        })
        it('PLAY_UNPAUSED event should change state to PLAYING', async () => {
            await verifyState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'PLAYING', () => {
                frontend.mythEventEmitter.emit('PLAY_STARTED', {})
            })
        })
        it('PLAY_PAUSED event should change state to PAUSED', async () => {
            await verifyState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'PAUSED', () => {
                frontend.mythEventEmitter.emit('PLAY_PAUSED', {})
            })
        })
        it('LIVETV_ENDED event should change state to STOPPED', async () => {
            await verifyState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'STOPPED', () => {
                frontend.mythEventEmitter.emit('LIVETV_ENDED', {})
            })
        })
        it('PLAY_STOPPED event should change state to STOPPED', async () => {
            await verifyState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'STOPPED', () => {
                frontend.mythEventEmitter.emit('PLAY_STOPPED', {})
            })
        })
    })
    context('Alexa Shadow', () => {
        context('refreshState', () => {
            afterEach(() => {
                sandbox.restore()
                frontend.resetDeltaId()
            })
            it('should emit PAUSED when watching and playspeed is 0', async () => {
                const feNock = createFrontendNock('playbackstate')
                    .get('/GetStatus')
                    .reply(200, () => {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'WatchingTv',
                                    playspeed: 0
                                }
                            }
                        }
                    })
                await verifyRefreshState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'PAUSED')
                expect(feNock.isDone()).to.be.true
            })
            it('should emit PLAYING when watching and playspeed != 0', async () => {
                const feNock = createFrontendNock('playbackstate')
                    .get('/GetStatus')
                    .reply(200, () => {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'WatchingSomething',
                                    playspeed: 1
                                }
                            }
                        }
                    })
                await verifyRefreshState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'PLAYING')
                expect(feNock.isDone()).to.be.true
            })
            it('should emit STOPPED when not watching', async () => {
                const feNock = createFrontendNock('playbackstate')
                    .get('/GetStatus')
                    .reply(200, () => {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'MainMenu',
                                    playspeed: 0
                                }
                            }
                        }
                    })
                await verifyRefreshState(sandbox, frontend, PlaybackStateReporter.namespace, 'playbackState', 'STOPPED')
                expect(feNock.isDone()).to.be.true
            })
        })
        it('refreshCapability should emit playbackState', async () => {
            await verifyRefreshCapability(sandbox, frontend, false, PlaybackStateReporter.namespace, ['playbackState'])
        })
    })
})