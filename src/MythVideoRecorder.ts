import { VideoRecorder } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { backend } from "mythtv-services-api";
import { MythAlexaEventFrontend } from "./Frontend";

type DirectiveType = VideoRecorder.NamespaceType;
const DirectiveName: DirectiveType = VideoRecorder.namespace;
type SearchAndRecordResponse = {
    payload: VideoRecorder.ResponsePayload
    state?: { [DirectiveName]?: SubType<EndpointState, DirectiveType> }
}
type Response = {
    payload: {}
    state?: { [DirectiveName]?: SubType<EndpointState, DirectiveType> }
}
export default class MythTvRecorder
    implements SubType<DirectiveHandlers, DirectiveType>, CapabilityEmitter {
    readonly supported: SupportedDirectives<DirectiveType> = ['CancelRecording', 'DeleteRecording', 'SearchAndRecord'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaEmitter.emit('capability', DirectiveName, true, deltaId);
    }
    async SearchAndRecord(payload: VideoRecorder.RequestPayload): Promise<SearchAndRecordResponse> {
        payload.entities.forEach(e => {
            if (e.type == 'Channel') {
                e.entityMetadata.channelCallSign
            }
        })
        backend.dvrService
        throw 'Not Implemeted'
    }
    async CancelRecording(payload: VideoRecorder.RequestPayload): Promise<Response> {
        throw 'Not Implemeted'
    }
    async DeleteRecording(payload: VideoRecorder.RequestPayload): Promise<Response> {
        throw 'Not Implemeted'
    }
}