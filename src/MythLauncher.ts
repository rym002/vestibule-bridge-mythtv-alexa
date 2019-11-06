import { Launcher } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { MythAlexaEventFrontend } from "./Frontend";

type DirectiveType = Launcher.NamespaceType;
const DirectiveName: DirectiveType = Launcher.namespace;
type Response = {
    payload: {}
    state?: { [DirectiveName]?: SubType<EndpointState, DirectiveType> }
}

export default class FrontendLauncher
    implements SubType<DirectiveHandlers, DirectiveType>, CapabilityEmitter {
    readonly supported: SupportedDirectives<DirectiveType> = ['LaunchTarget'];
    readonly defaultActionMappings = new Map<Launcher.Targets['identifier'], string>();
    readonly watchingTvActionMappings = new Map<Launcher.Targets['identifier'], string>();
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
        this.loadMappings()
    }
    private loadMappings() {
        this.defaultActionMappings.set('amzn1.alexa-ask-target.shortcut.69247', 'TV Recording Playback')
        this.defaultActionMappings.set('amzn1.alexa-ask-target.shortcut.68228', 'Program Guide')
        this.defaultActionMappings.set('amzn1.alexa-ask-target.shortcut.33122', 'Main Menu')
        this.defaultActionMappings.set('amzn1.alexa-ask-target.shortcut.82117', 'INFO')
        this.defaultActionMappings.set('amzn1.alexa-ask-target.shortcut.84333', 'Live TV')
        this.defaultActionMappings.set('amzn1.alexa-ask-target.shortcut.06715', 'TOGGLEPIPMODE')
        this.defaultActionMappings.set('amzn1.alexa-ask-target.shortcut.52304', 'TV Recording Playback')
        this.defaultActionMappings.set('amzn1.alexa-ask-target.shortcut.48625', 'Manage Recordings / Fix Conflicts')
        this.defaultActionMappings.set('amzn1.alexa-ask-target.shortcut.82307', 'Video Default')
        this.watchingTvActionMappings.set('amzn1.alexa-ask-target.shortcut.68228', 'GUIDE')
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaEmitter.emit('capability', DirectiveName, true, deltaId);
    }
    async LaunchTarget(payload: Launcher.Targets): Promise<Response> {
        let action: string | undefined;
        if (this.fe.isWatchingTv()) {
            action = this.watchingTvActionMappings.get(payload.identifier);
        }

        if (!action) {
            action = this.defaultActionMappings.get(payload.identifier)
        }
        if (action) {
            await this.fe.SendAction({
                Action: action
            })
        }
        return {
            payload: {}
        }
    }
}