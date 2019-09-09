import { RecordController } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, StateEmitter, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { backend } from "mythtv-services-api";
import { MythAlexaEventFrontend } from "./Frontend";


type DirectiveType = RecordController.NamespaceType;
const DirectiveName: DirectiveType = RecordController.namespace;
type Response = {
    payload: {}
    state?: { [DirectiveName]?: SubType<EndpointState, DirectiveType> }
}

export default class FrontendRecord
    implements SubType<DirectiveHandlers, DirectiveType>, StateEmitter, CapabilityEmitter {
    readonly supported: SupportedDirectives<DirectiveType> = ['StartRecording', 'StopRecording'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        const refreshStateBind = this.refreshState.bind(this);
        fe.alexaEmitter.on('refreshState', refreshStateBind);
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
        fe.mythEventEmitter.on('SCHEDULER_RAN', message => {
            this.refreshState(this.fe.eventDeltaId())
        });
    }
    refreshState(deltaId: symbol): void {
        const promise = this.updateRecordingState(deltaId);
        this.fe.alexaEmitter.watchDeltaUpdate(promise, deltaId);
    }

    private async updateRecordingState(deltaId: symbol): Promise<void> {
        const state = await this.recordState();
        this.updateState(state, deltaId);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaEmitter.emit('capability', DirectiveName, ['RecordingState'], deltaId);
    }

    async StartRecording(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'TOGGLERECORD'
        });
        return {
            payload: {},
            state: {
                'Alexa.RecordController': {
                    'RecordingState': 'RECORDING'
                }
            }
        }
    }
    async StopRecording(payload: {}): Promise<Response> {
        await this.fe.SendAction({
            Action: 'TOGGLERECORD'
        });
        return {
            payload: {},
            state: {
                'Alexa.RecordController': {
                    'RecordingState': 'NOT_RECORDING'
                }
            }
        }
    }
    async recordState(): Promise<RecordController.States> {
        if (await this.fe.isWatchingTv()) {
            const status = await this.fe.GetStatus();
            const state = status.State;
            const encoders = await backend.dvrService.GetEncoderList();
            const watchingLiveTV = encoders.filter(encoder => {
                return encoder.Connected
                    && encoder.Recording.Channel.ChanId == state.chanid
                    && encoder.Recording.Recording.RecGroup != 'LiveTV'
                    && encoder.Recording.ProgramId == state.programid;
            })
            if (watchingLiveTV.length > 0) {
                return 'RECORDING';
            }
        }
        return 'NOT_RECORDING';
    }

    private updateState(state: RecordController.States, deltaId: symbol): void {
        this.fe.alexaEmitter.emit('state', DirectiveName, 'RecordingState', state, deltaId);
    }
}