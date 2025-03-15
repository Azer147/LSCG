import { BaseSettingsModel, ModuleStats } from "./base";


export interface SpreadingOutfitModuleStats extends ModuleStats {
    CurrentOutfitIndex: number;
    CurrentRepeatNumber: number;
    NextActivationTime: number; // in ms
    ActivatedBy: number; // only needed as a spell ?
}

export interface SpreadingOutfitSettingsModel extends SpreadingOutfitPublicSettingsModel {
    AllowedRemote: boolean;
    AllowSelfStop: boolean;
}

export interface SpreadingOutfitPublicSettingsModel extends BaseSettingsModel {
    Active: boolean;
    Locked: boolean;
    Lockable: boolean;
    Outfit1: SpreadingOutfitCodeConfig;
    Outfit2: SpreadingOutfitCodeConfig;
    Outfit3: SpreadingOutfitCodeConfig;
    //DelayActive: boolean;
    //DelayTime: number;
    RepeatInterval: number; // in min
    ItemInterval: number; // in sec
    RepeatNumber: number;
    StartSpreadingTriggerWords: string;
    ActivateCurseTriggerWords: string;
    Internal: SpreadingOutfitModuleStats;
}

export interface SpreadingOutfitCodeConfig {
    Code: string;
    Enabled: boolean;
}