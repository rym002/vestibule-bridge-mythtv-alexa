import { EndpointHealth } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, StateEmitter } from "@vestibule-link/bridge-assistant-alexa";
import { MythAlexaEventFrontend, RegisteringDirective } from "./Frontend";

type DirectiveType = EndpointHealth.NamespaceType;
const DirectiveName: DirectiveType = EndpointHealth.namespace;
export default class FrontendHealth
    implements StateEmitter, CapabilityEmitter, RegisteringDirective {

    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.mythEventEmitter.on('CLIENT_CONNECTED', message => {
            this.updateConnectedState(this.fe.eventDeltaId())
        });
        fe.mythEventEmitter.on('CLIENT_DISCONNECTED', message => {
            this.updateDisconnectedState(this.fe.eventDeltaId())
        });
    }
    async register(): Promise<void> {
        this.fe.alexaConnector.listenRefreshEvents(this)
    }
    refreshState(deltaId: symbol): void {
        const state = this.endpointState();
        this.updateState(state, deltaId);
    }

    refreshCapability(deltaId: symbol): void {
        this.fe.alexaConnector.updateCapability(DirectiveName, ['connectivity'], deltaId);
    }

    private endpointState(): EndpointHealth.States {
        return this.fe.isConnected() ? 'OK' : 'UNREACHABLE'
    }

    private updateState(state: EndpointHealth.States, deltaId: symbol): void {
        this.fe.alexaConnector.updateState(DirectiveName, 'connectivity', {
            value: state
        }, deltaId);
    }
    private updateConnectedState(deltaId: symbol) {
        this.updateState('OK', deltaId);
    }
    private updateDisconnectedState(deltaId: symbol) {
        this.updateState('UNREACHABLE', deltaId);
    }
}