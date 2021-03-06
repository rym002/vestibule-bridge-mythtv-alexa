import { RecordController } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, StateEmitter, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { masterBackend, DvrService } from "mythtv-services-api";
import { MythAlexaEventFrontend, RegisteringDirective } from "./Frontend";


type DirectiveType = RecordController.NamespaceType;
const DirectiveName: DirectiveType = RecordController.namespace;
type Response = {
    payload: {}
    state?: { [DirectiveName]?: SubType<EndpointState, DirectiveType> }
}
export default class FrontendRecord
    implements SubType<DirectiveHandlers, DirectiveType>, StateEmitter, CapabilityEmitter, RegisteringDirective {
    private currentState?: {
        channel: number
        startTime: Date
    }
    readonly supported: SupportedDirectives<DirectiveType> = ['StartRecording', 'StopRecording'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        const refreshStateBind = this.refreshState.bind(this);
        fe.mythEventEmitter.on('PLAY_CHANGED', message => {
            if (this.fe.isWatchingTv() && message.CHANID && message.STARTTIME) {
                this.updateState('NOT_RECORDING', this.fe.eventDeltaId())
                this.currentState = {
                    channel: Number(message.CHANID),
                    startTime: message.STARTTIME
                }
            } else {
                this.currentState = undefined
            }
        })
        fe.masterBackendEmitter.on('REC_STARTED', message => {
            if (this.fe.isWatchingTv()
                && message.CHANID
                && message.STARTTIME
                && this.currentState
                && Number(message.CHANID) == this.currentState.channel) {
                this.currentState.startTime = message.STARTTIME
                this.updateState('NOT_RECORDING', this.fe.eventDeltaId())
            }
        })
        fe.masterBackendEmitter.on('SCHEDULER_RAN', message => {
            if (this.fe.isWatchingTv() && this.currentState) {
                const promise = this.updateRecordingStateFromCurrentProgram(this.fe.eventDeltaId());
                this.fe.alexaConnector.watchDeltaUpdate(promise, this.fe.eventDeltaId());
            }
        })
        fe.mythEventEmitter.on('LIVETV_ENDED', message => {
            this.currentState = undefined
            this.updateState('NOT_RECORDING', this.fe.eventDeltaId())
        })
    }
    async register(): Promise<void> {
        this.fe.alexaConnector.registerDirectiveHandler(DirectiveName, this);
    }
    refreshState(deltaId: symbol): void {
        const promise = this.updateRecordingStateFromStatus(deltaId);
        this.fe.alexaConnector.watchDeltaUpdate(promise, deltaId);
    }

    private async updateRecordingStateFromStatus(deltaId: symbol): Promise<void> {
        if (this.fe.isWatchingTv()) {
            const status = await this.fe.GetStatus();
            const state = status.State;
            this.currentState = {
                channel: state.chanid,
                startTime: state['starttime']
            }
            const recordingState = await this.lookupRecordState({
                ChanId: this.currentState.channel,
                StartTime: this.currentState.startTime
            });
            this.updateState(recordingState, deltaId);
        } else {
            this.updateState('NOT_RECORDING', deltaId)
        }
    }
    private async updateRecordingStateFromCurrentProgram(deltaId: symbol): Promise<void> {
        const recordingState = await this.lookupRecordState({
            ChanId: this.currentState.channel,
            StartTime: this.currentState.startTime
        })
        this.updateState(recordingState, deltaId);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaConnector.updateCapability(DirectiveName, ['RecordingState'], deltaId);
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
        this.fe.alexaConnector.updateState(DirectiveName, 'RecordingState', state, deltaId);
    }
}