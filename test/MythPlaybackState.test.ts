import { PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import Handler from '../src/MythPlaybackState';
import { createContextSandbox, createFrontendNock, createMockFrontend, getContextSandbox, getFrontend, restoreSandbox, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';

describe('MythPlaybackState', function () {
    beforeEach(async function () {
        createContextSandbox(this)
        const frontend = await createMockFrontend('playbackstate', this);
        frontend.mythEventEmitter.emit('PLAY_STARTED', {
            SENDER: ''
        })
        new Handler(frontend)
    })
    afterEach(function () {
        restoreSandbox(this)
    })
    context('MythtTV Events', function () {
        it('PLAY_CHANGED event should change state to PLAYING', async function () {
            await verifyMythEventState(getFrontend(this), 'PLAY_CHANGED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'PLAYING' })
        })
        it('PLAY_STARTED event should change state to PLAYING', async function () {
            await verifyMythEventState(getFrontend(this), 'PLAY_STARTED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'PLAYING' })
        })
        it('PLAY_UNPAUSED event should change state to PLAYING', async function () {
            await verifyMythEventState(getFrontend(this), 'PLAY_UNPAUSED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'PLAYING' })
        })
        it('PLAY_PAUSED event should change state to PAUSED', async function () {
            await verifyMythEventState(getFrontend(this), 'PLAY_PAUSED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'PAUSED' })
        })
        it('PLAY_STOPPED event should change state to STOPPED', async function () {
            await verifyMythEventState(getFrontend(this), 'PLAY_STOPPED', {
                SENDER: ''
            }, PlaybackStateReporter.namespace, 'playbackState', { state: 'STOPPED' })
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
                    await verifyRefreshState(getFrontend(this), PlaybackStateReporter.namespace, 'playbackState', { state: 'PAUSED' })
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
                    await verifyRefreshState(getFrontend(this), PlaybackStateReporter.namespace, 'playbackState', { state: 'PLAYING' })
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
                    await verifyRefreshState(getFrontend(this), PlaybackStateReporter.namespace, 'playbackState', { state: 'STOPPED' })
                })
            })
        })
        it('refreshCapability should emit playbackState', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, PlaybackStateReporter.namespace, ['playbackState'])
        })
    })
})