import { RecordController } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, StateEmitter, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { masterBackend, DvrService } from "mythtv-services-api";
import { MythAlexaEventFrontend } from "./Frontend";


type DirectiveType = RecordController.NamespaceType;
const DirectiveName: DirectiveType = RecordController.namespace;
type Response = {
    payload: {}
    state?: { [DirectiveName]?: SubType<EndpointState, DirectiveType> }
}
export default class FrontendRecord
    implements SubType<DirectiveHandlers, DirectiveType>, StateEmitter, CapabilityEmitter {
    private currentState?: {
        channel: number
        recordedId: number
    }
    readonly supported: SupportedDirectives<DirectiveType> = ['StartRecording', 'StopRecording'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        const refreshStateBind = this.refreshState.bind(this);
        fe.alexaEmitter.on('refreshState', refreshStateBind);
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
        fe.mythEventEmitter.on('PLAY_CHANGED', message => {
            if (this.fe.isWatchingTv() && message.CHANID && message.RECORDEDID) {
                this.updateState('NOT_RECORDING', this.fe.eventDeltaId())
                this.currentState = {
                    channel: Number(message.CHANID),
                    recordedId: Number(message.RECORDEDID)
                }
            } else {
                this.currentState = undefined
            }
        })
        fe.masterBackendEmitter.on('REC_STARTED', message => {
            if (this.fe.isWatchingTv()
                && message.RECGROUP == 'LiveTV'
                && message.CHANID
                && message.RECORDEDID
                && this.currentState
                && Number(message.CHANID) == this.currentState.channel) {
                this.currentState.recordedId = Number(message.RECORDEDID)
                this.updateState('NOT_RECORDING', this.fe.eventDeltaId())
            }
        })
        fe.masterBackendEmitter.on('SCHEDULER_RAN', message => {
            if (this.fe.isWatchingTv() && this.currentState) {
                const promise = this.updateRecordingStateFromCurrentProgram(this.fe.eventDeltaId());
                this.fe.alexaEmitter.watchDeltaUpdate(promise, this.fe.eventDeltaId());
            }
        })
        fe.mythEventEmitter.on('LIVETV_ENDED', message => {
            this.currentState = undefined
            this.updateState('NOT_RECORDING', this.fe.eventDeltaId())
        })
    }
    refreshState(deltaId: symbol): void {
        const promise = this.updateRecordingStateFromStatus(deltaId);
        this.fe.alexaEmitter.watchDeltaUpdate(promise, deltaId);
    }

    private async updateRecordingStateFromStatus(deltaId: symbol): Promise<void> {
        if (this.fe.isWatchingTv()) {
            const status = await this.fe.GetStatus();
            const state = status.State;
            const recordedId = await masterBackend.dvrService.RecordedIdForKey({
                ChanId: state.chanid,
                StartTime: state['starttime']
            })
            this.currentState = {
                channel: state.chanid,
                recordedId: recordedId
            }
            const recordingState = await this.lookupRecordState({
                RecordedId: recordedId
            });
            this.updateState(recordingState, deltaId);
        } else {
            this.updateState('NOT_RECORDING', deltaId)
        }
    }
    private async updateRecordingStateFromCurrentProgram(deltaId: symbol): Promise<void> {
        const recordingState = await this.lookupRecordState({
            RecordedId: this.currentState.recordedId
        })
        this.updateState(recordingState, deltaId);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaEmitter.emit('capability', DirectiveName, ['RecordingState'], deltaId);
    }

    async StartRecording(payload: {}): Promise<Response> {
        return this.toggleRecord('RECORDING')
    }
    async StopRecording(payload: {}): Promise<Response> {
        return this.toggleRecord('NOT_RECORDING')
    }

    private async toggleRecord(expectedState: RecordController.States): Promise<Response> {
        const monitorState = this.fe.monitorStateChange(RecordController.namespace, {
            name: 'RecordingState',
            value: expectedState
        })
        await this.fe.SendAction({
            Action: 'TOGGLERECORD'
        });
        return {
            payload: {},
            state: await monitorState
        }

    }
    async lookupRecordState(request: DvrService.Request.GetRecorded): Promise<RecordController.States> {
        const recorded = await masterBackend.dvrService.GetRecorded(request)
        return recorded.Recording.RecGroup == 'LiveTV'
            ? 'NOT_RECORDING'
            : 'RECORDING'
    }

    private updateState(state: RecordController.States, deltaId: symbol): void {
        this.fe.alexaEmitter.emit('state', DirectiveName, 'RecordingState', state, deltaId);
    }
}