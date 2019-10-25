import { PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythPlaybackState';
import { createFrontendNock, createMockFrontend, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';

describe('MythPlaybackState', function () {
    const sandbox = createSandbox()
    beforeEach(async function () {
        const frontend = await createMockFrontend('playbackstate');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend
    })
    afterEach(function () {
        sandbox.restore()
    })
    context('MythtTV Events', function () {
        it('LIVETV_STARTED event should change state to PLAYING', async function () {
            await verifyMythEventState(this.test['frontend'], 'LIVETV_STARTED', {}, PlaybackStateReporter.namespace, 'playbackState', 'PLAYING')
        })
        it('PLAY_CHANGED event should change state to PLAYING', async function () {
            await verifyMythEventState(this.test['frontend'], 'PLAY_CHANGED', {}, PlaybackStateReporter.namespace, 'playbackState', 'PLAYING')
        })
        it('PLAY_STARTED event should change state to PLAYING', async function () {
            await verifyMythEventState(this.test['frontend'], 'PLAY_STARTED', {}, PlaybackStateReporter.namespace, 'playbackState', 'PLAYING')
        })
        it('PLAY_UNPAUSED event should change state to PLAYING', async function () {
            await verifyMythEventState(this.test['frontend'], 'PLAY_UNPAUSED', {}, PlaybackStateReporter.namespace, 'playbackState', 'PLAYING')
        })
        it('PLAY_PAUSED event should change state to PAUSED', async function () {
            await verifyMythEventState(this.test['frontend'], 'PLAY_PAUSED', {}, PlaybackStateReporter.namespace, 'playbackState', 'PAUSED')
        })
        it('LIVETV_ENDED event should change state to STOPPED', async function () {
            await verifyMythEventState(this.test['frontend'], 'LIVETV_ENDED', {}, PlaybackStateReporter.namespace, 'playbackState', 'STOPPED')
        })
        it('PLAY_STOPPED event should change state to STOPPED', async function () {
            await verifyMythEventState(this.test['frontend'], 'PLAY_STOPPED', {}, PlaybackStateReporter.namespace, 'playbackState', 'STOPPED')
        })
    })
    context('Alexa Shadow', function () {
        context('refreshState', function () {
            it('should emit PAUSED when watching and playspeed is 0', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
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
                await verifyRefreshState(this.test['frontend'], PlaybackStateReporter.namespace, 'playbackState', 'PAUSED')
            })
            it('should emit PLAYING when watching and playspeed != 0', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
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
                await verifyRefreshState(this.test['frontend'], PlaybackStateReporter.namespace, 'playbackState', 'PLAYING')
            })
            it('should emit STOPPED when not watching', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
                    .get('/GetStatus')
                    .reply(200, function () {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'MainMenu',
                                    playspeed: 0
                                }
                            }
                        }
                    })
                await verifyRefreshState(this.test['frontend'], PlaybackStateReporter.namespace, 'playbackState', 'STOPPED')
                expect(feNock.isDone()).to.be.true
            })
        })
        it('refreshCapability should emit playbackState', async function () {
            await verifyRefreshCapability(sandbox, this.test['frontend'], false, PlaybackStateReporter.namespace, ['playbackState'])
        })
    })
})