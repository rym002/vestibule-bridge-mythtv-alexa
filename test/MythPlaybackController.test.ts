import { PlaybackController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import Handler from '../src/MythPlaybackController';
import { createContextSandbox, createMockFrontend, getContextSandbox, getFrontend, restoreSandbox, verifyActionDirective, verifyRefreshCapability } from './MockHelper';


describe('MythPlaybackController', function () {
    beforeEach(async function () {
        createContextSandbox(this)
        const frontend = await createMockFrontend('playback', this);
        new Handler(frontend)
    })
    afterEach(function () {
        restoreSandbox(this)
    })
    context('directives', function () {
        context('PLAYING', () => {
            beforeEach(function () {
                const fe = getFrontend(this)
                fe.alexaEmitter.endpoint["Alexa.PlaybackStateReporter"] = {
                    playbackState: {
                        state: 'PLAYING'
                    }
                }
                fe.alexaEmitter.endpoint["Alexa.ChannelController"] = {
                    channel: {}
                }
            })
            it('FastForward should send SEEKFFWD action', async function () {
                await verifyActionDirective(getFrontend(this), PlaybackController.namespace, 'FastForward', {}, [{
                    actionName: 'SEEKFFWD',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('Rewind should send SEEKRWND action', async function () {
                await verifyActionDirective(getFrontend(this), PlaybackController.namespace, 'Rewind', {}, [{
                    actionName: 'SEEKRWND',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('Next should send SKIPCOMMERCIAL action', async function () {
                await verifyActionDirective(getFrontend(this), PlaybackController.namespace, 'Next', {}, [{
                    actionName: 'SKIPCOMMERCIAL',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('Pause should send PAUSE action', async function () {
                await verifyActionDirective(getFrontend(this), PlaybackController.namespace, 'Pause', {}, [{
                    actionName: 'PAUSE',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: {
                        'Alexa.PlaybackStateReporter': {
                            'playbackState': {
                                state: 'PAUSED'
                            }
                        }
                    }
                }, {
                    'Alexa.PlaybackStateReporter': {
                        playbackState: {
                            state: 'PAUSED'
                        }
                    }
                })
            })
            it('Previous should send SKIPCOMMBACK action', async function () {
                await verifyActionDirective(getFrontend(this), PlaybackController.namespace, 'Previous', {}, [{
                    actionName: 'SKIPCOMMBACK',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('StartOver should send JUMPSTART action', async function () {
                await verifyActionDirective(getFrontend(this), PlaybackController.namespace, 'StartOver', {}, [{
                    actionName: 'JUMPSTART',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('Stop should send STOPPLAYBACK action', async function () {
                const frontend = getFrontend(this);
                frontend.mythEventEmitter.emit('LIVETV_STARTED', {
                    SENDER: ''
                })
                await verifyActionDirective(frontend, PlaybackController.namespace, 'Stop', {}, [{
                    actionName: 'STOPPLAYBACK',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: {
                        'Alexa.PlaybackStateReporter': {
                            playbackState: {
                                state: 'STOPPED'
                            }
                        },
                        'Alexa.ChannelController': {
                            channel: null
                        }
                    }
                }, {
                    'Alexa.PlaybackStateReporter': {
                        playbackState: {
                            state: 'STOPPED'
                        }
                    },
                    'Alexa.ChannelController': {
                        channel: null
                    }
                })
            })
        })
        context('PAUSED', () => {
            beforeEach(function () {
                const fe = getFrontend(this)
                fe.alexaEmitter.endpoint["Alexa.PlaybackStateReporter"] = {
                    playbackState: {
                        state: 'PAUSED'
                    }
                }
            })
            it('Play should send PLAY action', async function () {
                await verifyActionDirective(getFrontend(this), PlaybackController.namespace, 'Play', {}, [{
                    actionName: 'PLAY',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: {
                        'Alexa.PlaybackStateReporter': {
                            playbackState: {
                                state: 'PLAYING'
                            }
                        }
                    }
                }, {
                    'Alexa.PlaybackStateReporter': {
                        playbackState: {
                            state: 'PLAYING'
                        }
                    }
                })
            })
        })
    })
    context('Alexa Shadow', function () {
        it('refreshCapability should emit All Operations', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, PlaybackController.namespace, ['FastForward', 'Rewind', 'Next', 'Pause', 'Play', 'Previous', 'StartOver', 'Stop'])
        })
    })

})