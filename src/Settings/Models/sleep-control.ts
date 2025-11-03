import { BaseSettingsModel, ModuleStats } from "./base";

// BaseSleepTime with added ExtendTime (to be reset the day after with LastUpdated)
export interface TodaySleepTimeModel {
    CurrentSleepTime: string; // Date.toString() format
    LastUpdated: string; // Date.toString() format
    WarningStepDone: number;
    SleepModeActive: boolean;
    Disabled: boolean;
}

export interface HourMinuteModel {
    Hours: number; // 0 - 23
    Minutes: number; // 0 - 59
}

export interface SleepControlSettingsModel extends BaseSettingsModel {
    TodaySleepTime: TodaySleepTimeModel | undefined;

    MondaySleepTime: HourMinuteModel;
    TuesdaySleepTime: HourMinuteModel;
    WednesdaySleepTime: HourMinuteModel;
    ThursdaySleepTime: HourMinuteModel;
    FridaySleepTime: HourMinuteModel;
    SaturdaySleepTime: HourMinuteModel;
    SundaySleepTime: HourMinuteModel;

    Allowed: "Public" | "Friend" | "Whitelist" | "Lover" | "Owner" | "Self";
    LockedUntil: string | undefined; // Date.toString() format
    SelfAllowChatCommands: boolean;
    WarningTime: HourMinuteModel;
    SleepTimeTolerance: HourMinuteModel;
    DelayTime: HourMinuteModel;
    TimeoutTime: HourMinuteModel;
    SleepTimeDuration: HourMinuteModel;
    SleepOutfitKey: string;

    UseOutfit: boolean;
    UseMuteState: boolean;
    UseDeafenState: boolean;
    UseBlindState: boolean;
    UseSleepState: boolean;
}
