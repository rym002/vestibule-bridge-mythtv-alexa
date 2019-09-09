import { PlaybackController } from '@vestibule-link/alexa-video-skill-types';
import { CapabilityEmitter, DirectiveHandlers, SupportedDirectives } from '@vestibule-link/bridge-assistant-alexa';
import { SubType } from '@vestibule-link/iot-types';
import { MythAlexaEventFrontend } from "./Frontend";

type DirectiveType = PlaybackController.NamespaceType;
const DirectiveName: DirectiveType = PlaybackController.namespace;
type Response = {
    payload: {}
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

    async Play(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'PLAY'
        });
        return {
            payload: {}
        }
    }
    async Pause(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'PAUSE'
        });
        return {
            payload: {}
        }
    }
    async FastForward(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'SEEKFFWD'
        });
        return {
            payload: {}
        }
    }
    async Rewind(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'SEEKRWND'
        });
        return {
            payload: {}
        }
    }
    async Stop(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'STOPPLAYBACK'
        });
        return {
            payload: {}
        }
    }
    async Next(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'SKIPCOMMERCIAL'
        });
        return {
            payload: {}
        }
    }
    async Previous(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'SKIPCOMMBACK'
        });
        return {
            payload: {}
        }
    }
    async StartOver(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'JUMPSTART'
        });
        return {
            payload: {}
        }
    }
}