import { EndpointHealth } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, StateEmitter } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { MythAlexaEventFrontend } from "./Frontend";

type DirectiveType = EndpointHealth.NamespaceType;
const DirectiveName: DirectiveType = EndpointHealth.namespace;
export default class FrontendHealth
    implements StateEmitter, CapabilityEmitter {

    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshState', this.refreshState.bind(this));
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.mythEventEmitter.on('CLIENT_CONNECTED', message => {
            this.updateConnectedState(this.fe.eventDeltaId())
        });
        fe.mythEventEmitter.on('CLIENT_DISCONNECTED', message => {
            this.updateDisconnectedState(this.fe.eventDeltaId())
        });
    }
    refreshState(deltaId: symbol): void {
        const promise = this.checkState(deltaId);
        this.fe.alexaEmitter.watchDeltaUpdate(promise, deltaId);
    }
    private async checkState(deltaId: symbol): Promise<void> {
        const state = await this.endpointState();
        this.updateState(state, deltaId);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaEmitter.emit('capability', DirectiveName, ['connectivity'], deltaId);
    }

    private async endpointState(): Promise<EndpointHealth.States> {
        try {
            await this.fe.SendAction({
                Action: 'FAKE'
            }, true);
            return 'OK';
        } catch (err) {
            console.log(err)
            return 'UNREACHABLE';
        }
    }
    async state(): Promise<SubType<EndpointState, DirectiveType>> {
        return {
            connectivity: await this.endpointState()
        }
    }

    private updateState(state: EndpointHealth.States, deltaId: symbol): void {
        this.fe.alexaEmitter.emit('state', DirectiveName, 'connectivity', state, deltaId);
    }
    private updateConnectedState(deltaId: symbol) {
        this.updateState('OK', deltaId);
    }
    private updateDisconnectedState(deltaId: symbol) {
        this.updateState('UNREACHABLE', deltaId);
    }
}