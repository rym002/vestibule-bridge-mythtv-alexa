import { RecordController } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, StateEmitter, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { masterBackend, DvrService } from "mythtv-services-api";
import { MythAlexaEventFrontend } from "./Frontend";
import { InternalTypes } from "mythtv-services-api/dist/CommonTypes";


type DirectiveType = RecordController.NamespaceType;
const DirectiveName: DirectiveType = RecordController.namespace;
type Response = {
    payload: {}
    state?: { [DirectiveName]?: SubType<EndpointState, DirectiveType> }
}
export default class FrontendRecord
    implements SubType<DirectiveHandlers, DirectiveType>, StateEmitter, CapabilityEmitter {
    private currentProgram?: InternalTypes.ChanIdRequest
    readonly supported: SupportedDirectives<DirectiveType> = ['StartRecording', 'StopRecording'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        const refreshStateBind = this.refreshState.bind(this);
        fe.alexaEmitter.on('refreshState', refreshStateBind);
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
        fe.mythEventEmitter.on('PLAY_CHANGED', message => {
            if (this.fe.isWatchingTv() && message.CHANID && message.STARTTIME) {
                this.currentProgram = {
                    ChanId: Number(message.CHANID),
                    StartTime: message.STARTTIME
                }
            } else {
                this.currentProgram = undefined
            }
        })
        fe.masterBackendEmitter.on('REC_STARTED', message => {
            if (this.fe.isWatchingTv()
                && message.RECGROUP == 'LiveTV'
                && message.CHANID
                && message.STARTTIME
                && this.currentProgram
                && Number(message.CHANID) == this.currentProgram.ChanId) {
                this.currentProgram['StartTime'] = message.STARTTIME
            }
        })
        fe.masterBackendEmitter.on('SCHEDULER_RAN', message => {
            if (this.fe.isWatchingTv() && this.currentProgram) {
                const promise = this.updateRecordingStateFromCurrentProgram(this.fe.eventDeltaId());
                this.fe.alexaEmitter.watchDeltaUpdate(promise, this.fe.eventDeltaId());
            }
        })
        fe.mythEventEmitter.on('LIVETV_ENDED', message => {
            this.currentProgram = undefined
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
            const recordingState = await this.lookupRecordState({
                ChanId: state.chanid,
                StartTime: state['starttime']
            });
            this.updateState(recordingState, deltaId);
        } else {
            this.updateState('NOT_RECORDING', deltaId)
        }
    }
    private async updateRecordingStateFromCurrentProgram(deltaId: symbol): Promise<void> {
        const recordingState = await this.lookupRecordState(this.currentProgram)
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
        const monitorState = this.fe.monitorStateChange('Alexa.RecordController', {
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