import { InfoEmitter } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointInfo } from "@vestibule-link/iot-types";
import { masterBackend } from "mythtv-services-api";
import { getEndpointName, MANUFACTURER_NAME, MythAlexaEventFrontend, RegisteringDirective } from "./Frontend";

const ALEXA_FRIENDLY_NAME = "AlexaFriendlyName";

export default class FrontendInfo implements InfoEmitter, RegisteringDirective {
    constructor(readonly fe: MythAlexaEventFrontend) {
    }
    refreshInfo(deltaId: symbol): void {
        const promise = this.updateInfo(deltaId);
        this.fe.alexaConnector.watchDeltaUpdate(promise, deltaId);
    }
    async register(): Promise<void> {
        this.fe.alexaConnector.listenRefreshEvents(this)
    }

    private async updateInfo(deltaId: symbol): Promise<void> {
        const hostId = this.fe.hostname();
        const alexaDeviceName = await masterBackend.mythService.GetSetting({
            Key: ALEXA_FRIENDLY_NAME,
            HostName: hostId,
            Default: hostId
        });

        const endpointInfo: EndpointInfo = {
            manufacturerName: MANUFACTURER_NAME,
            description: `${MANUFACTURER_NAME} Frontend ${hostId}`,
            friendlyName: alexaDeviceName,
            displayCategories: ['TV'],
            endpointId: getEndpointName(this.fe)
        }
        this.fe.alexaConnector.updateInfo(endpointInfo, deltaId);
    }
}
