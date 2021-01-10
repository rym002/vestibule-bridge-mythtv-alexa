import { PlaybackController, PlaybackStateReporter, ChannelController } from '@vestibule-link/alexa-video-skill-types';
import { CapabilityEmitter, DirectiveHandlers, SupportedDirectives } from '@vestibule-link/bridge-assistant-alexa';
import { SubType, EndpointState } from '@vestibule-link/iot-types';
import { MythAlexaEventFrontend, RegisteringDirective } from "./Frontend";

type DirectiveType = PlaybackController.NamespaceType;
const DirectiveName: DirectiveType = PlaybackController.namespace;
type Response = {
    payload: {}
    state?: {
        [PlaybackStateReporter.namespace]?: SubType<EndpointState, PlaybackStateReporter.NamespaceType>,
        [ChannelController.namespace]?: SubType<EndpointState, ChannelController.NamespaceType>
    }
}
export default class FrontendPlayback
    implements SubType<DirectiveHandlers, DirectiveType>, CapabilityEmitter, RegisteringDirective {
    readonly supported: SupportedDirectives<DirectiveType> = ['FastForward', 'Rewind', 'Next', 'Pause', 'Play', 'Previous', 'StartOver', 'Stop'];

    constructor(readonly fe: MythAlexaEventFrontend) {
    }
    async register(): Promise<void> {
        this.fe.alexaConnector.registerDirectiveHandler(DirectiveName, this);
    }

    refreshCapability(deltaId: symbol): void {
        this.fe.alexaConnector.updateCapability(DirectiveName, this.supported, deltaId);
    }

    async sendAction(action: string, expectedPlayback: PlaybackStateReporter.States): Promise<Response> {
        const playbackMonitor = this.fe.monitorStateChange(PlaybackStateReporter.namespace, {
            name: 'playbackState',
            value: {
                state: expectedPlayback
            }
        })
        let channelMonitor: Promise<{ [ChannelController.namespace]?: SubType<EndpointState, ChannelController.NamespaceType> }> | undefined
        if (expectedPlayback == 'STOPPED' && this.fe.isWatchingTv()) {
            channelMonitor = this.fe.monitorStateChange(ChannelController.namespace, {
                name: 'channel',
                value: null
            })
        }
        await this.fe.SendAction({
            Action: action
        });
        const playbackState = await playbackMonitor
        const channelState = channelMonitor ? await channelMonitor : undefined
        const state = playbackState ? { ...playbackState, ...channelState } : undefined
        return {
            payload: {},
            state: state
        }
    }
    async Play(payload: {}): Promise<Response> {
        return this.sendAction('PLAY', 'PLAYING');
    }
    async Pause(payload: {}): Promise<Response> {
        return this.sendAction('PAUSE', 'PAUSED');
    }
    async FastForward(payload: {}): Promise<Response> {
        return this.sendAction('SEEKFFWD', 'PLAYING');
    }
    async Rewind(payload: {}): Promise<Response> {
        return this.sendAction('SEEKRWND', 'PLAYING');
    }
    async Stop(payload: {}): Promise<Response> {
        return this.sendAction('STOPPLAYBACK', 'STOPPED');
    }
    async Next(payload: {}): Promise<Response> {
        return this.sendAction('SKIPCOMMERCIAL', 'PLAYING');
    }
    async Previous(payload: {}): Promise<Response> {
        return this.sendAction('SKIPCOMMBACK', 'PLAYING');
    }
    async StartOver(payload: {}): Promise<Response> {
        return this.sendAction('JUMPSTART', 'PLAYING');
    }
}