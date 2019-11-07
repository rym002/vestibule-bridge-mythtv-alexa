import { PlaybackController, PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { CapabilityEmitter, DirectiveHandlers, SupportedDirectives } from '@vestibule-link/bridge-assistant-alexa';
import { SubType, EndpointState } from '@vestibule-link/iot-types';
import { MythAlexaEventFrontend } from "./Frontend";

type DirectiveType = PlaybackController.NamespaceType;
const DirectiveName: DirectiveType = PlaybackController.namespace;
type Response = {
    payload: {}
    state?: { [PlaybackStateReporter.namespace]?: SubType<EndpointState, PlaybackStateReporter.NamespaceType> }
}
export default class FrontendPlayback
    implements SubType<DirectiveHandlers, DirectiveType>, CapabilityEmitter {
    readonly supported: SupportedDirectives<DirectiveType> = ['FastForward', 'Rewind', 'Next', 'Pause', 'Play', 'Previous', 'StartOver', 'Stop'];

    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaEmitter.emit('capability', DirectiveName, this.supported, deltaId);
    }

    async sendAction(action: string, expectedPlayback: PlaybackStateReporter.States): Promise<Response> {
        const stateMonitor = this.fe.monitorStateChange(PlaybackStateReporter.namespace, {
            name: 'playbackState',
            value: expectedPlayback
        })
        await this.fe.SendAction({
            Action: action
        });
        return {
            payload: {},
            state: await stateMonitor
        }
    }
    async Play(payload: {}): Promise<Response> {
        return this.sendAction('PLAY','PLAYING');
    }
    async Pause(payload: {}): Promise<Response> {
        return this.sendAction('PAUSE','PAUSED');
    }
    async FastForward(payload: {}): Promise<Response> {
        return this.sendAction('SEEKFFWD','PLAYING');
    }
    async Rewind(payload: {}): Promise<Response> {
        return this.sendAction('SEEKRWND','PLAYING');
    }
    async Stop(payload: {}): Promise<Response> {
        return this.sendAction('STOPPLAYBACK','STOPPED');
    }
    async Next(payload: {}): Promise<Response> {
        return this.sendAction('SKIPCOMMERCIAL','PLAYING');
    }
    async Previous(payload: {}): Promise<Response> {
        return this.sendAction('SKIPCOMMBACK','PLAYING');
    }
    async StartOver(payload: {}): Promise<Response> {
        return this.sendAction('JUMPSTART','PLAYING');
    }
}