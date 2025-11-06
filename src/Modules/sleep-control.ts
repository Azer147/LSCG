import { BaseModule } from "base";
import { getModule } from "modules";
import { ModuleCategory, Subscreen } from "Settings/setting_definitions";
import { SendAction, getRandomInt, OnChat, settingsSave, removeAllHooksByModule, isPhraseInString, GetDelimitedList, OnAction, GetMetadata, GetTargetCharacter, hookFunction, GetItemNameAndDescriptionConcat, sendLSCGCommandBeep, isObject, isBind, isCloth, isCosplay, isBody, isGenitals, isPronouns, toItemBundle, parseFromBase64, ICONS } from "../utils";
import { CursedItemModel, CursedItemWorn, ItemType, CursedItemSettingsModel } from "Settings/Models/cursed-item";
import { HourMinuteModel, SleepControlSettingsModel, TodaySleepTimeModel } from "Settings/Models/sleep-control"
import { GuiCursedItems } from "Settings/cursed-items";
import { StateModule } from "./states";
import { BaseState } from "./States/BaseState";
import { CursedItemState } from "./States/CursedItemState";
import { CommandListener, CoreModule } from "./core";
import { OutfitCollectionModule } from "./outfitCollection";
import { LSCGSpellEffect, OutfitOption, SpellDefinition } from "Settings/Models/magic";
import { GuiSleepControl } from "Settings/sleep-control";

export class SleepControlModule extends BaseModule {
    DEFAULT_CHECK_TIME_MS: number = 30000; // 30sec
    checkInterval: number = 0;
    enforceCmdCount: number = 0;
    disableCmdCount: number = 0;

    SleepControlPublicCommand: Map<string, () => void> = new Map([
        ["SLEEP MODE HELP", () => { this.commandHelp(); }],
        ["SLEEP MODE INFO", () => { this.commandInfo(); }],
        ["SLEEP MODE DELAY", () => { this.commandDelay(); }],
        /*["SLEEP MODE TIMEOUT", () => { console.log("test command SLEEP MODE TIMEOUT"); }],*/
        ["SLEEP MODE RESET", () => { this.commandReset(); }],
        ["SLEEP MODE DISABLE", () => { this.commandDisable(); }],
        ["SLEEP MODE ENFORCE", () => { this.commandEnforce(); }]
    ]);

    get defaultSettings() {
        return <SleepControlSettingsModel>{
            enabled: false,
            TodaySleepTime: undefined, // (internal setting, take account for cmds)
            MondaySleepTime: {Hours: 0, Minutes: 0},
            TuesdaySleepTime: {Hours: 0, Minutes: 0},
            WednesdaySleepTime: {Hours: 0, Minutes: 0},
            ThursdaySleepTime: {Hours: 0, Minutes: 0},
            FridaySleepTime: {Hours: 0, Minutes: 0},
            SaturdaySleepTime: {Hours: 0, Minutes: 0},
            SundaySleepTime: {Hours: 0, Minutes: 0},
            Allowed: "Whitelist",
            LockedUntil: undefined,
            SelfAllowChatCommands: true,
            WarningTime: {Hours: 0, Minutes: 10},
            SleepTimeTolerance: {Hours: 1, Minutes: 0},
            DelayTime: {Hours: 0, Minutes: 20},
            TimeoutTime: {Hours: 0, Minutes: 5},
            SleepTimeDuration: {Hours: 6, Minutes: 0},
            //SleepOutfitKey: undefined,
            UseOutfit: false,
            UseBlindState: false,
            UseDeafenState: false,
            UseMuteState: false,
            UseSleepState: false,
        };
    }

    get settings(): SleepControlSettingsModel {
        return super.settings as SleepControlSettingsModel;
    }

    get stateModule(): StateModule {
        return getModule<StateModule>("StateModule");
    }

    // TODO
    get settingsScreen(): Subscreen | null {
        return GuiSleepControl;
    }


    load(): void {
        // old things to delete from settings (TODO)
        // SleepOutfitCode
        // BaseSleepTime
        // WeekendBaseTime

        this.checkInterval = setInterval(() => { this.sleepModeCheck() }, this.DEFAULT_CHECK_TIME_MS);

        OnChat(1, ModuleCategory.SleepControl, (data, sender, msg, metadata) => {
            let senderIsAllowed: boolean = false;
            if (sender && sender.MemberNumber) {
                switch (this.settings.Allowed) {
                    case "Public": 
                        senderIsAllowed = Player.BlackList.indexOf(sender.MemberNumber) == -1;
                    case "Friend":
                        senderIsAllowed ||= (Player.FriendList?.indexOf(sender.MemberNumber) ?? -1) > -1;
                    case "Lover":
                        senderIsAllowed ||= Player.IsLoverOfMemberNumber(sender.MemberNumber);
                    case "Whitelist":
                        senderIsAllowed ||= Player.WhiteList.indexOf(sender.MemberNumber) > -1;
                    case "Owner":
                        senderIsAllowed ||= Player.IsOwnedByMemberNumber(sender.MemberNumber);
                    case "Self":
                        if (!this.settings.SelfAllowChatCommands && sender.MemberNumber == Player.MemberNumber) {
                            senderIsAllowed = false;
                        } else {
                            senderIsAllowed ||= (sender.MemberNumber == Player.MemberNumber);
                        }
                        break;
                }
            }

            if (!this.Enabled) {
                return;
            }
            this.checkForCommands(msg, senderIsAllowed);
        });
    }

    run(): void {

    }

    unload(): void {
        clearInterval(this.checkInterval);
        removeAllHooksByModule(ModuleCategory.SleepControl);
    }

    getSleepTimeSettingsFromDayNum(dayNum: number) {
        switch (dayNum) {
            case 0:
                return this.settings.SundaySleepTime;
            case 1:
                return this.settings.MondaySleepTime;
            case 2:
                return this.settings.TuesdaySleepTime;
            case 3:
                return this.settings.WednesdaySleepTime;
            case 4:
                return this.settings.ThursdaySleepTime;
            case 5:
                return this.settings.FridaySleepTime;
            case 6:
                return this.settings.SaturdaySleepTime;
            default:
                return this.settings.MondaySleepTime;
        }
    }

    getCurrentOrNextBaseSleepDate(): Date | undefined {
        let dateNow = new Date();

        // Check if previous day Sleep time is finished
        let prevDayNum = dateNow.getDay() - 1;
        if (prevDayNum < 0) {
            prevDayNum = 6;
        }
        let previousSleepTime = this.getSleepTimeSettingsFromDayNum(prevDayNum);
        // if previousSleepTime have a -1, it mean this day is disabled, hence no need to check it
        if (previousSleepTime.Hours != -1 && previousSleepTime.Minutes != -1) {
            let previousSleepDate = new Date();
            previousSleepDate.setDate(previousSleepDate.getDate()-1);
            previousSleepDate.setHours(previousSleepTime.Hours);
            previousSleepDate.setMinutes(previousSleepTime.Minutes);
            previousSleepDate.setSeconds(0);
            //console.debug("getCurrentOrNextBaseSleepDate: previousSleepDate: ", previousSleepDate);
            
            let previousSleepEndDate = this.getNewDateWithAddition(previousSleepDate, this.settings.SleepTimeDuration);
            if (previousSleepEndDate > dateNow) {
                // Previous sleep time is not finished
                // For example if its 00:10 and previous day sleep time is 23h50, we should use the previous day
                //console.debug("getCurrentOrNextBaseSleepDate: selecting previousSleepDate !");
                return previousSleepDate;
            }
        }

        let todayBaseTime: HourMinuteModel = this.getSleepTimeSettingsFromDayNum(dateNow.getDay());
        let todaySleepTime = new Date();
        if (todayBaseTime.Hours != -1 && todayBaseTime.Minutes != -1) {
            todaySleepTime.setHours(todayBaseTime.Hours);
            todaySleepTime.setMinutes(todayBaseTime.Minutes);
            todaySleepTime.setSeconds(0);
            //console.debug("getCurrentOrNextBaseSleepDate: todaySleepTime: ", todaySleepTime);
        } else {
            // today is disabled, we just force the next condition to true so todaySleepTime is not picked.
            todaySleepTime.setDate(todaySleepTime.getDate()-2);
        }

        let todaySleepEndDate = this.getNewDateWithAddition(todaySleepTime, this.settings.SleepTimeDuration);
        if (todaySleepEndDate < dateNow) {
            // After sleep time for today is past (today sleep time + sleep duration), use the next day
            // For example if now is 23h00, this day sleep time is 01h00, which ended 16h ago, so we use next day.
            let nextSleepTime = new Date();
            nextSleepTime.setDate(nextSleepTime.getDate()+1);

            let nextSleepBaseTime = this.getSleepTimeSettingsFromDayNum(nextSleepTime.getDay());
            if (nextSleepBaseTime.Hours != -1 && nextSleepBaseTime.Minutes != -1) {
                nextSleepTime.setHours(nextSleepBaseTime.Hours);
                nextSleepTime.setMinutes(nextSleepBaseTime.Minutes);
                nextSleepTime.setSeconds(0);
                //console.debug("getCurrentOrNextBaseSleepDate: nextSleepTime: ", nextSleepTime);
                //console.debug("getCurrentOrNextBaseSleepDate: selecting nextSleepTime !");
                
                return nextSleepTime;
            } else {
                // nextSleepTime is a disabled day, since no other date are relevant, just return nothing.
                return undefined;
            }
        }
        //console.debug("getCurrentOrNextBaseSleepDate: selecting todaySleepTime !");
        return todaySleepTime;
    }

    getCurrentSleepTime(): Date | undefined {
        let dateNow = new Date();

        if (this.settings.TodaySleepTime) {
            let lastUpdatedDate = new Date(Date.parse(this.settings.TodaySleepTime.LastUpdated));
            let shouldResetTime = this.getNewDateWithAddition(lastUpdatedDate, this.settings.SleepTimeDuration);

            if (dateNow > shouldResetTime) {
                // resetting
                if (this.settings.TodaySleepTime.SleepModeActive) {
                    this.releaseSleepMode();
                }
                this.settings.TodaySleepTime = undefined;
            }
            else {
                if (this.settings.TodaySleepTime.Disabled) {
                    return undefined;
                } else {
                    return new Date(Date.parse(this.settings.TodaySleepTime.CurrentSleepTime));
                }
            }
        }
        // if no TodaySleepTime, build TodaySleepTime
        let nextSleepTime = this.getCurrentOrNextBaseSleepDate();
        console.debug("getCurrentSleepTime: nextSleepTime: ", nextSleepTime);

        if (!nextSleepTime) {
            // no point to build todaySleepTime if nextSleepTime is disabled
            this.settings.TodaySleepTime = undefined;
            settingsSave(true);
            return undefined;
        }

        let todaySleepTime: TodaySleepTimeModel = {
            CurrentSleepTime: nextSleepTime.toString(),
            LastUpdated: new Date().toString(),
            WarningStepDone: 0,
            SleepModeActive: false,
            Disabled: false
        }
        this.settings.TodaySleepTime = todaySleepTime;
        settingsSave(true);
        return new Date(Date.parse(this.settings.TodaySleepTime.CurrentSleepTime));
    }

    // Main function
    sleepModeCheck() {
        if (!this.settings.enabled) {
            console.log("sleepModeCheck: Sleep mode module is disabled.");
            return;
        }

        let dateNow = new Date();
        // dateTime.getHours()

        if (this.settings.LockedUntil) {
			// Check for end of Locked
			let dateNow = new Date();
			let lockedFinishDate = new Date(Date.parse(this.settings.LockedUntil));
			if (dateNow >= lockedFinishDate) {
				this.settings.LockedUntil = undefined;
                settingsSave(true);
			}
		}

        //console.log("sleepModeCheck: now hour:min: ", dateNow.getHours(), ":", dateNow.getMinutes());

        // getCurrentSleepTime also do releaseSleepMode() if needed
        let curSleepTime = this.getCurrentSleepTime();
        if (!curSleepTime) {
            //console.log("sleepModeCheck: Sleep mode is disabled for today !");
            return;
        }

        //console.log("sleepModeCheck: curSleepTime hour:min: ", curSleepTime.getHours(), ":", curSleepTime.getMinutes());

        let warningStartDate = this.getNewDateWithAddition(curSleepTime, this.settings.WarningTime, true);
        //console.log("sleepModeCheck: warningStartDate hour:min: ", warningStartDate.getHours(), ":", warningStartDate.getMinutes());

        if (dateNow > curSleepTime) {
            // should be tied up
            this.enforceSleepMode();
        }
        else if (dateNow >= warningStartDate) {
            // should be in warning mode
            this.displayWarningMessage(curSleepTime);
        }
    }

    enforceSleepMode() {
        if (this.settings.TodaySleepTime && this.settings.TodaySleepTime.SleepModeActive) {
            this.applySleepModeEffects(false);
            return;
        }
        this.getCurrentSleepTime();
        let curSleepTime = new Date();

        let todaySleepTime: TodaySleepTimeModel = {
            CurrentSleepTime: curSleepTime.toString(),
            LastUpdated: new Date().toString(),
            WarningStepDone: 4,
            SleepModeActive: true,
            Disabled: false
        }
        this.settings.TodaySleepTime = todaySleepTime;
        settingsSave(true);

        this.applySleepModeEffects(true);
    }

    applySleepModeEffects(force: boolean) {
        let outfitCode = getModule<OutfitCollectionModule>("OutfitCollectionModule")?.data.GetOutfitCode(this.settings.SleepOutfitKey);
        if (this.settings.UseOutfit && outfitCode && (force || !this.stateModule.RedressedState.Active)) {
            let fakeSpell: SpellDefinition = {
                Name: "Sleep Mode",
                Creator: Player.MemberNumber,
                Effects: [LSCGSpellEffect.outfit],
                AllowPotion: false,
                AllowVoiceCast: false,
                Outfit: { Code: outfitCode,
                    Key: "Sleep Mode Key",
                    Option: OutfitOption.both }
            }
            this.stateModule.RedressedState.Apply(fakeSpell);
        }

        if (this.settings.UseBlindState && (force || !this.stateModule.BlindState.Active)) {
            this.stateModule.BlindState.Activate();
        }
        if (this.settings.UseDeafenState && (force || !this.stateModule.DeafState.Active)) {
            this.stateModule.DeafState.Activate();
        }
        if (this.settings.UseMuteState && (force || !this.stateModule.GaggedState.Active)) {
            this.stateModule.GaggedState.Activate();
        }
        if (this.settings.UseSleepState && (force || !this.stateModule.SleepState.Active)) {
            this.stateModule.SleepState.Activate();
        }
    }

    releaseSleepMode() {
        if (this.settings.UseOutfit && this.stateModule.RedressedState.Active) {
            this.stateModule.RedressedState.Recover();
        }
        if (this.settings.UseBlindState && this.stateModule.BlindState.Active) {
            this.stateModule.BlindState.Recover();
        }
        if (this.settings.UseDeafenState && this.stateModule.DeafState.Active) {
            this.stateModule.DeafState.Recover();
        }
        if (this.settings.UseMuteState && this.stateModule.GaggedState.Active) {
            this.stateModule.GaggedState.Recover();
        }
        if (this.settings.UseSleepState && this.stateModule.SleepState.Active) {
            this.stateModule.SleepState.Recover();
        }
    }

    displayWarningMessage(curSleepTime: Date) {
        let dateNow = new Date();

        if (!this.settings.TodaySleepTime) {
            console.warn("Sleep mode: displayWarningMessage: Error: TodaySleepTime does not exist!");
            return;
        }

        if (this.settings.WarningTime.Hours == 0 && this.settings.WarningTime.Minutes == 0) {
            // warning disabled
            return;
        }

        let WarningTimeMinutes = (this.settings.WarningTime.Hours * 60) + this.settings.WarningTime.Minutes;
        
        let secondWarnMinutes = Math.floor(WarningTimeMinutes / 2);
        let thirdWarnMinutes = Math.floor(WarningTimeMinutes / 5);

        let firstWarnDate = this.getNewDateWithAddition(curSleepTime, this.settings.WarningTime, true); // substract
        let secondWarnDate = this.getNewDateWithAddition(curSleepTime, {Hours: 0, Minutes: secondWarnMinutes}, true); // substract
        let thirdWarnDate = this.getNewDateWithAddition(curSleepTime, {Hours: 0, Minutes: thirdWarnMinutes}, true); // substract
        let fourthWarnDate = this.getNewDateWithAddition(curSleepTime, {Hours: 0, Minutes: 1}, true); // substract

        let timeLeftBeforeSleepStr = SleepControlModule.getRelativeTimeToString(curSleepTime.getTime() - dateNow.getTime())
        if (dateNow >= fourthWarnDate && this.settings.TodaySleepTime.WarningStepDone < 4) {
            SendAction(`%NAME% Will be put in Sleep mode in less than 1 minutes. Time to say goodnight~`);
            this.settings.TodaySleepTime.WarningStepDone = 4;
        }
        else if (dateNow >= thirdWarnDate && this.settings.TodaySleepTime.WarningStepDone < 3) {
            SendAction(`%NAME% Will be put in Sleep mode in ${timeLeftBeforeSleepStr} minutes.`);
            SendAction(`%NAME% can get her Sleep time delayed by ${this.HourMinutesToString(this.settings.DelayTime)} if anyone other than %NAME% type in "%NAME% SLEEP MODE DELAY" in the chat. Please don't abuse this, %NAME% need to have enough Sleep`);
            this.settings.TodaySleepTime.WarningStepDone = 3;
        }
        else if (dateNow >= secondWarnDate && this.settings.TodaySleepTime.WarningStepDone < 2) {
            SendAction(`%NAME% Will be put in Sleep mode in ${timeLeftBeforeSleepStr} minutes. %NAME% can get her Sleep time delayed by ${this.HourMinutesToString(this.settings.DelayTime)} if anyone other than %NAME% type in "%NAME% SLEEP MODE DELAY" in the chat.`);
            this.settings.TodaySleepTime.WarningStepDone = 2;
        }
        else if (dateNow >= firstWarnDate && this.settings.TodaySleepTime.WarningStepDone < 1) {
            SendAction(`%NAME% Will be put in Sleep mode in ${timeLeftBeforeSleepStr}.`);
            SendAction(`Type in "%NAME% SLEEP MODE HELP" for more informations.`);
            this.settings.TodaySleepTime.WarningStepDone = 1;
        }

        settingsSave(true);
        return;
    }

    // Main function for commands
    checkForCommands(msg: string, senderIsAllowed: boolean) {
        msg = msg.toLowerCase();
        if (!msg.includes(Player.AccountName.toLowerCase()) && !msg.includes(Player.MemberNumber.toString())
                && !(Player.Nickname.length != 0 && msg.includes(Player.Nickname.toLowerCase()))) {
            return; // commands not destined to this Player
        }

        for (let cmd of this.SleepControlPublicCommand) {
            if (msg.includes(cmd[0].toLowerCase())) {
                if (!senderIsAllowed) {
                    SendAction("You are not permitted to use Sleep mode chat commands.");
                } else {
                    cmd[1]();
                }
                return;
            }
        }

    }

    commandHelp() {
        let msg = "SLEEP MODE Available commands:\n";
        for (let cmd of this.SleepControlPublicCommand) {
            msg += "%NAME% " + cmd[0] + "\n";
        }
        SendAction(msg);
    }

    commandInfo() {
        let msg = "%NAME% SLEEP MODE Informations:\n";

        let dateNow = new Date();
        let curSleepDate = this.getCurrentSleepTime();
        console.log("DEBUG: commandInfo: curSleepDate: ", curSleepDate);
        if (!curSleepDate) {
            let reltimeString = "<UNKNOWN TIME>";
            if (this.settings.TodaySleepTime) {
                let lastUpdatedDate: Date = new Date(Date.parse(this.settings.TodaySleepTime.LastUpdated));
                reltimeString = SleepControlModule.getRelativeTimeToString(dateNow.getTime() - lastUpdatedDate.getTime())
                msg += "Sleep mode has been disabled for today " + reltimeString + " ago.\n";
            } else {
                msg += "Sleep mode has been disabled for today.\n";
            }
        }
        else {
            if (dateNow >= curSleepDate) {
                let reltimeString = SleepControlModule.getRelativeTimeToString(dateNow.getTime() - curSleepDate.getTime())
                msg += "Sleep mode is already active since " + reltimeString + " .\n";
            }
            else {
                let reltimeString = SleepControlModule.getRelativeTimeToString(curSleepDate.getTime() - dateNow.getTime())
                msg += "Next Sleep mode scheduled to start in " + reltimeString + " .\n";
            }
        }

        SendAction(msg);
        console.log("commandInfo: this.settings: ", this.settings);
    }

    commandDelay() {
        let dateNow = new Date();
        let curSleepDate = this.getCurrentSleepTime();
        if (!curSleepDate) {
            SendAction(`%NAME% Sleep Mode is disabled for today, Delay impossible.`);
            return;            
        }

        /*if (this.inSleepMode(dateNow)) {
            SendAction(`%NAME% is already in Sleep Mode, Delay impossible.`);
            return;
        }*/

        if ((this.settings.DelayTime.Hours <= 0 && this.settings.DelayTime.Minutes <= 0)
                || (this.settings.SleepTimeTolerance.Hours == 0 && this.settings.SleepTimeTolerance.Minutes == 0)
        ) {
            SendAction(`Delay command has been disabled, no way out for you~.`);
            return;
        }

        let currentBaseSleepTime = this.getCurrentOrNextBaseSleepDate();
        if (!currentBaseSleepTime) {
            // This shouldn't happen, as getCurrentSleepTime should also return undefined before
            SendAction(`%NAME% Sleep Mode is disabled for today, Delay impossible.`);
            return;
        }

        let limitDelayTime = undefined; // undefined => infinite
        if (this.settings.SleepTimeTolerance.Hours != -1 && this.settings.SleepTimeTolerance.Minutes != -1) {
            limitDelayTime = this.getNewDateWithAddition(currentBaseSleepTime, this.settings.SleepTimeTolerance);
            if (curSleepDate >= limitDelayTime) {
                SendAction(`%NAME% Sleep mode is already scheduled too late, Delay impossible.`);
                return;
            }
        }

        let minTimeHourMin: HourMinuteModel = {Hours: 0, Minutes: 15}; // default if WarningTime is 0
        if (this.settings.WarningTime.Hours > 0 || this.settings.WarningTime.Minutes > 0) {
            minTimeHourMin = this.settings.WarningTime;
        }
        
        // Minimum time to use delay is 2 * WarningTime (or default)
        let minTimeToDelay = this.getNewDateWithAddition(currentBaseSleepTime, minTimeHourMin, true);
        minTimeToDelay = this.getNewDateWithAddition(minTimeToDelay, minTimeHourMin, true);
        if (dateNow < minTimeToDelay) {
            SendAction(`%NAME% Sleep mode time is too far away, Try again later.`);
            return;
        }

        if (this.settings.TodaySleepTime) {
            if (this.inSleepMode(dateNow)) {
                this.releaseSleepMode();
            }

            let newSleepTime = this.getNewDateWithAddition(curSleepDate, this.settings.DelayTime);
            if (limitDelayTime && newSleepTime > limitDelayTime) {
                newSleepTime = limitDelayTime;
            }
            this.settings.TodaySleepTime.CurrentSleepTime = newSleepTime.toString();
            this.settings.TodaySleepTime.WarningStepDone = 0;
            this.settings.TodaySleepTime.SleepModeActive = false;
            settingsSave(true);
            SendAction(`%NAME% Sleep mode time is delayed, scheduled in ${SleepControlModule.getRelativeTimeToString(newSleepTime.getTime() - dateNow.getTime())}`);
            return;
        } else {
            console.warn("commandDelay: TodaySleepTime is undefined, it shoudln't happen there...");
        }
    }

    commandEnforce() {
        this.enforceCmdCount += 1;
        if (this.enforceCmdCount < 2) {
            SendAction(`Sleep mode ENFORCE: Are you sure, this will last ${this.HourMinutesToString(this.settings.SleepTimeDuration)} ? Enter ENFORCE command once again to confirm.`);
            return;
        }
        this.enforceCmdCount = 0;
        SendAction(`Sleep mode ENFORCE command accepted, %NAME%'s Sleep mode is starting immediatly`);
        this.enforceSleepMode();
    }

    commandDisable() {
        this.disableCmdCount += 1;
        if (this.disableCmdCount == 1) {
            SendAction(`Sleep mode DISABLE: Are you sure ? Don't listen to %NAME% too much, she need to sleep...\nIf you are sure, enter DISABLE command 2 more time to confirm.`);
        }
        if (this.disableCmdCount == 2) {
            SendAction(`Sleep mode DISABLE: Are you really sure ? Enter DISABLE command one last time to confirm.`);
        }
        if (this.disableCmdCount < 3) {
            return;
        }
        this.disableCmdCount = 0;
        SendAction(`Sleep mode DISABLE command accepted, %NAME%'s Sleep mode is disabled for today`);
        this.releaseSleepMode();

        this.getCurrentSleepTime(); // to build TodaySleepTime
        if (this.settings.TodaySleepTime) {
            this.settings.TodaySleepTime.Disabled = true;
            this.settings.TodaySleepTime.LastUpdated = new Date().toString();
        }
        settingsSave(true);
    }

    commandReset() {
        SendAction(`Sleep mode RESET command accepted.`);
        if (this.settings.TodaySleepTime && this.settings.TodaySleepTime.SleepModeActive) {
            this.releaseSleepMode();
        }
        this.settings.TodaySleepTime = undefined;
        this.getCurrentSleepTime(); // rebuild TodaySleepTime
        settingsSave(true);
        this.commandInfo();
    }

    inSleepMode(dateNow: Date): boolean {
        if (this.settings.TodaySleepTime && this.settings.TodaySleepTime.SleepModeActive) {
            return true;
        }

        // Secondary failsafe (not sure if usefull)
        /*
        let curSleepDate = this.getCurrentSleepTime();
        if (!curSleepDate) {
            return false;
        }
        else if (dateNow > curSleepDate) {
            return true;
        }*/

        return false;
    }

    // Helper
    getNewDateWithAddition(date: Date, addTime: HourMinuteModel, substract: boolean = false) {
        let newDate = new Date(date.getTime());

        if (addTime.Hours != 0) {
            if (substract) {
                newDate.setHours(newDate.getHours() - addTime.Hours);
            } else {
                newDate.setHours(newDate.getHours() + addTime.Hours);
            }
        }
        if (addTime.Minutes != 0) {
            if (substract) {
                newDate.setMinutes(newDate.getMinutes() - addTime.Minutes);
            } else {
                newDate.setMinutes(newDate.getMinutes() + addTime.Minutes);
            }
        }

        return newDate;
    }

    HourMinutesToString(time: HourMinuteModel): string {
        let str = "";
        if (time.Hours != 0) {
            str += (time.Hours + " hours");
        }
        if (time.Minutes != 0 || str == "") {
            if (str != "") str += " ";
            str += (time.Minutes + " minutes");
        }
        return str;
    }

    static getRelativeTimeToString(elapsed: number): string {
        let msPerMinute = 60 * 1000;
        let msPerHour = msPerMinute * 60;
        let msPerDay = msPerHour * 24;
        let msPerMonth = msPerDay * 30;
        let msPerYear = msPerDay * 365;

        let sign = 1;
        if (elapsed < 0) {
            sign = -1;
            elapsed = Math.abs(elapsed);
        }

        if (elapsed < msPerMinute) {
            return sign * Math.round(elapsed/1000) + ' seconds';
        }

        else if (elapsed < msPerHour) {
            return sign * Math.round(elapsed/msPerMinute) + ' minutes';
        }

        else if (elapsed < msPerDay ) {
            // sign * Math.round(elapsed/msPerHour ) + ' hours';
            let totalMinutes = Math.round(elapsed/msPerMinute);
            let hours = Math.floor(totalMinutes / 60);
            let minutes = totalMinutes - (hours * 60);
            return hours + ' hours ' + minutes + ' minutes ';
        }

        else if (elapsed < msPerMonth) {
            return 'about ' + sign * Math.round(elapsed/msPerDay) + ' days';
        }

        else if (elapsed < msPerYear) {
            return 'about ' + sign * Math.round(elapsed/msPerMonth) + ' months';
        }

        else {
            return 'about ' + sign * Math.round(elapsed/msPerYear ) + ' years';
        }
    }
}
