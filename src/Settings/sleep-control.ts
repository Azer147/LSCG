import { getModule } from "modules";
import { HypnoModule } from "Modules/hypno";
import { ICONS } from "utils";
import { HypnoSettingsModel } from "./Models/hypno";
import { GuiSubscreen, HelpInfo, Setting } from "./settingBase";
import { StateConfig, StateSettingsModel } from "./Models/states";
import { StateModule } from "Modules/states";
import { SplatterSettingsModel } from "./Models/base";
import { SplatterModule } from "Modules/splatter";
import { HourMinuteModel, SleepControlSettingsModel } from "./Models/sleep-control";
import { SleepControlModule } from "Modules/sleep-control";
import { OutfitCollectionModule } from "Modules/outfitCollection";

export class GuiSleepControl extends GuiSubscreen {

	get name(): string {
		return "Sleep Control";
	}

	get icon(): string {
		return ICONS.HYPNO;
	}

	get settings(): SleepControlSettingsModel {
		return super.settings as SleepControlSettingsModel;
	}

	get splatterModule(): SleepControlModule {
		return this.module as SleepControlModule;
	}

	get help(): HelpInfo {
		return {
			label: 'Open Splatter Wiki on GitHub',
			link: 'https://github.com/littlesera/LSCG/wiki/Splatters'
		}
	}

	get multipageStructure(): Setting[][] {
		return [[
			<Setting>{
				type: "checkbox",
				label: "Enable Sleep Control:",
				description: "Enable the Sleep Control feature.",
				setting: () => this.settings.enabled ?? false,
				setSetting: (val) => this.settings.enabled = val,
				disabled: !Player.LSCG.GlobalModule.enabled || this.settings.LockedUntil
			}, <Setting>{
				type: "checkbox",
				label: this.getLockedString(),
				//description: "Lock settings for 1 week ! (Be carefull settings are correct~)",
				description: "Lock settings for 1 week ! (Not locking during beta)",
				setting: () => this.settings.LockedUntil ? true : false,
				setSetting: (val) => val ? this.setLockedUntil() : this.settings.LockedUntil = undefined,
				//disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
				disabled: !this.settings.enabled // debug
			}, <Setting>{
				type: "checkbox",
				label: "Chat commands self use: ",
				description: "If yourself is allowed to use the chat commands",
				setting: () => this.settings.SelfAllowChatCommands,
				setSetting: (val) => this.settings.SelfAllowChatCommands = val,
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			}, <Setting>{
				type: "label",
				label: "Settings and commands permission",
				description: "Who is allowed to change your settings remotely and use the chat commands (Note: you can never use chat commands yourself)",
				setting: () => this.settings.enabled ?? false,
				setSetting: (val) => this.settings.enabled = val,
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			}, <Setting>{
				type: "number",
				label: "Warning time (minutes)",
				id: "sleepmode_warningtime",
				description: "Warnings will start to appear this time before Sleep mode start (0 to disable)",
				setting: () => this.HourMinutesToMinutes(this.settings.WarningTime) ?? 10,
				setSetting: (val) => { this.settings.WarningTime = this.minutesToHourMinutesTime(Math.min(Math.max(val, 0), 60)) },
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
				//overrideWidth: 200
			}, <Setting>{
				type: "number",
				label: "Delay added (minutes)",
				id: "sleepmode_delaytime",
				description: "How much time is added per use of Delay command (SLEEP MODE DELAY) (0 to disable)",
				setting: () => this.HourMinutesToMinutes(this.settings.DelayTime) ?? 20,
				setSetting: (val) => { this.settings.DelayTime = this.minutesToHourMinutesTime(Math.min(Math.max(val, 0), 60)) },
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			}, <Setting>{
				type: "number",
				label: "Delay tolerance (minutes)",
				id: "sleepmode_delaytolerance",
				description: "How much time you can delay (-1 for infinite, 0 to disable)",
				setting: () => this.HourMinutesToMinutes(this.settings.SleepTimeTolerance) ?? 60,
				setSetting: (val) => { this.settings.SleepTimeTolerance = this.minutesToHourMinutesTime(Math.min(Math.max(val, -1), 240)) },
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			}, <Setting>{
				type: "number",
				label: "Sleep time (hours)",
				id: "sleepmode_sleeptime",
				description: "Sleep mode will stay active for that long. (at least 1h required)",
				setting: () => this.HourMinutesToHours(this.settings.SleepTimeDuration) ?? 6,
				setSetting: (val) => { this.settings.SleepTimeDuration =  {Hours: Math.min(Math.max(val, 1), 22), Minutes: 0} },
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			}, <Setting>{
				type: "dropdown",
				id: "sleepmode_outfitKey",
				label: "Sleep applied Outfit:",
				description: "Outfit name that will be forced when Sleep mode activate.",
				overrideWidth: 600,
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
				setting: () => this.settings.SleepOutfitKey ?? "",
				setSetting: (val) => this.settings.SleepOutfitKey = val,
				options: getModule<OutfitCollectionModule>("OutfitCollectionModule")?.data.GetOutfitNames()?.sort() ?? []
			}, <Setting>{
				type: "checkbox",
				label: "Sleep mode apply Mute: ",
				description: "If checked, Sleep mode will also apply Mute state",
				setting: () => this.settings.UseMuteState,
				setSetting: (val) => this.settings.UseMuteState = val,
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			}, <Setting>{
				type: "checkbox",
				label: "Sleep mode apply Blind: ",
				description: "If checked, Sleep mode will also apply Blind state",
				setting: () => this.settings.UseBlindState,
				setSetting: (val) => this.settings.UseBlindState = val,
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			}, <Setting>{
				type: "checkbox",
				label: "Sleep mode apply Deafen: ",
				description: "If checked, Sleep mode will also apply Deafen state",
				setting: () => this.settings.UseDeafenState,
				setSetting: (val) => this.settings.UseDeafenState = val,
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			},<Setting>{
				type: "label",
				label: "",
				description: ""
			}, <Setting>{
				type: "checkbox",
				label: "Sleep mode apply Outfit: ",
				description: "If checked, Sleep mode will also apply the Outfit",
				setting: () => this.settings.UseOutfit,
				setSetting: (val) => this.settings.UseOutfit = val,
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			}, <Setting>{
				type: "checkbox",
				label: "Sleep mode apply Sleep: ",
				description: "If checked, Sleep mode will also apply Sleep state",
				setting: () => this.settings.UseSleepState,
				setSetting: (val) => this.settings.UseSleepState = val,
				disabled: (!this.settings.enabled || this.settings.LockedUntil != undefined),
			}
		], [
			<Setting>{
				type: "label",
				label: "Monday:",
				description: "Monday Sleep time (use -1 to disable for that day)",
			}, <Setting>{
				type: "label",
				label: "Tuesday:",
				description: "Tuesday Sleep time (use -1 to disable for that day)",
			}, <Setting>{
				type: "label",
				label: "Wednesday:",
				description: "Wednesday Sleep time (use -1 to disable for that day)",
			}, <Setting>{
				type: "label",
				label: "Thursday:",
				description: "Thursday Sleep time (use -1 to disable for that day)",
			}, <Setting>{
				type: "label",
				label: "Friday:",
				description: "Friday Sleep time (use -1 to disable for that day)",
			}, <Setting>{
				type: "label",
				label: "Saturday:",
				description: "Saturday Sleep time (use -1 to disable for that day)",
			}, <Setting>{
				type: "label",
				label: "Sunday:",
				description: "Sunday Sleep time (use -1 to disable for that day)",
			}
		]]
	}

	getLockedString(): string {
		if (this.settings.LockedUntil) {
			let dateNow = new Date();
			let lockedFinishDate = new Date(Date.parse(this.settings.LockedUntil));
			let timeLeftStr = SleepControlModule.getRelativeTimeToString(lockedFinishDate.getTime() - dateNow.getTime());
			return "Lock settings (" + timeLeftStr + " left): ";
		} else {
			return "Lock settings (1 Week): ";
		}
	}

	setLockedUntil() {
		let date = new Date();
		date.setDate(date.getDate() + 7);
		this.settings.LockedUntil = date.toString();
	}

	HourMinutesToMinutes(hourMinute: HourMinuteModel): number {
		let minutes: number = 0;

		if (hourMinute) {
			minutes = hourMinute.Minutes;
			minutes += (hourMinute.Hours * 60);
		}
		return minutes;
	}

	HourMinutesToHours(hourMinute: HourMinuteModel): number {
		let hours: number = 0;

		if (hourMinute) {
			hours = hourMinute.Hours;
			hours += Math.floor(hourMinute.Minutes / 60);
		}
		return hours;
	}

	minutesToHourMinutesTime(minutes: number): HourMinuteModel {
		let hourMin: HourMinuteModel = {Hours: 0, Minutes: 0};

		hourMin.Hours = Math.floor(minutes / 60);
		hourMin.Minutes = minutes - (hourMin.Hours * 60);
		return hourMin;
	}

	// Input Elem that need one field for Hours and one field for minutes
	hourMinuteElemList: Setting[] = [
		<Setting>{
			id: "sleepmode_monday",
			type: "number",
			description: "Monday Sleep Time",
			setting: () => this.settings.MondaySleepTime ?? {Hours: 0, Minutes: 0},
			setSetting: (val) => { this.settings.MondaySleepTime = this.adjustDayTimeMinMax(val) },
		},<Setting>{
			id: "sleepmode_tuesday",
			type: "number",
			description: "Tuesday Sleep Time",
			setting: () => this.settings.TuesdaySleepTime ?? {Hours: 0, Minutes: 0},
			setSetting: (val) => { this.settings.TuesdaySleepTime = this.adjustDayTimeMinMax(val) },
		},<Setting>{
			id: "sleepmode_wednesday",
			type: "number",
			description: "Wednesday Sleep Time",
			setting: () => this.settings.WednesdaySleepTime ?? {Hours: 0, Minutes: 0},
			setSetting: (val) => { this.settings.WednesdaySleepTime = this.adjustDayTimeMinMax(val) },
		},<Setting>{
			id: "sleepmode_thursday",
			type: "number",
			description: "Thursday Sleep Time",
			setting: () => this.settings.ThursdaySleepTime ?? {Hours: 0, Minutes: 0},
			setSetting: (val) => { this.settings.ThursdaySleepTime = this.adjustDayTimeMinMax(val) },
		},<Setting>{
			id: "sleepmode_friday",
			type: "number",
			description: "Friday Sleep Time",
			setting: () => this.settings.FridaySleepTime ?? {Hours: 0, Minutes: 0},
			setSetting: (val) => { this.settings.FridaySleepTime = this.adjustDayTimeMinMax(val) },
		},<Setting>{
			id: "sleepmode_saturday",
			type: "number",
			description: "Saturday Sleep Time",
			setting: () => this.settings.SaturdaySleepTime ?? {Hours: 0, Minutes: 0},
			setSetting: (val) => { this.settings.SaturdaySleepTime = this.adjustDayTimeMinMax(val) },
		},<Setting>{
			id: "sleepmode_sunday",
			type: "number",
			description: "Sunday Sleep Time",
			setting: () => this.settings.SundaySleepTime ?? {Hours: 0, Minutes: 0},
			setSetting: (val) => { this.settings.SundaySleepTime = this.adjustDayTimeMinMax(val) },
		}
	];

	// -1 - 23h, -1 - 60m (negative value to disable)
	adjustDayTimeMinMax(HourMin: HourMinuteModel): HourMinuteModel {
		if (HourMin.Hours > 23) {
			HourMin.Hours = 23;
		}
		if (HourMin.Hours < -1) {
			HourMin.Hours = -1;
		}
		
		if (HourMin.Minutes > 60) {
			HourMin.Minutes = 60;
		}
		if (HourMin.Minutes < -1) {
			HourMin.Minutes = -1;
		}
		return HourMin;
	}

	getAllowedToString(): string {
		switch (this.settings.Allowed) {
			case "Public":
				return "Everyone (except blacklisted)";
			case "Friend":
				return "Friends and above";
			case "Whitelist":
				return "Whitelisted and above";
			case "Lover":
				return "Lovers and above";
			case "Owner":
				return "Owners or Self";
			default:
				return "Self Only";
		}
	}

	clickAllow() {
		switch (this.settings.Allowed) {
			case "Public":
				this.settings.Allowed = "Friend";
				break;
			case "Friend":
				this.settings.Allowed = "Whitelist";
				break;
			case "Whitelist":
				this.settings.Allowed = "Lover";
				break;
			case "Lover":
				this.settings.Allowed = "Owner";
				break;
			case "Owner":
				this.settings.Allowed = "Self";
				break;
			default:
				this.settings.Allowed = "Public";
				break;
		}
	}

	Load() {
		if (this.settings.LockedUntil) {
			// Check for end of Locked
			let dateNow = new Date();
			let lockedFinishDate = new Date(Date.parse(this.settings.LockedUntil));
			if (dateNow >= lockedFinishDate) {
				this.settings.LockedUntil = undefined;
			}
		}
		super.Load();

		for (let elem of this.hourMinuteElemList) {
			ElementCreateInput(elem.id + "_h", "number", elem.setting().Hours, "3");
			ElementCreateInput(elem.id + "_m", "number", elem.setting().Minutes, "3");
		}
	}

	Exit() {
		for (let elem of this.hourMinuteElemList) {
			elem.setSetting({Hours: ElementValue(elem.id + "_h"), Minutes: ElementValue(elem.id + "_m")});
			ElementRemove(elem.id + "_h");
			ElementRemove(elem.id + "_m");
		}

		super.Exit();
	}

	Run() {
		super.Run();

		// Hide everything first
		for (let elem of this.hourMinuteElemList) {
			this.ElementHide(elem.id + "_h");
			this.ElementHide(elem.id + "_m");
		}

		let disabled: boolean = (!this.settings.enabled || this.settings.LockedUntil != undefined);

		MainCanvas.textAlign = "center";
		if (PreferencePageCurrent == 1) {
			// Allowed remote button
			let allowButtonLabel = this.getAllowedToString();
			DrawButton(780, this.getYPos(3) - 32, 400, 64, allowButtonLabel, "White", undefined, undefined, disabled);
		}
		else if (PreferencePageCurrent == 2) {
			MainCanvas.textAlign = "center";

			let idx = 0;
			for (let elem of this.hourMinuteElemList) {
				let posX = this.getXPos(idx) + 300;
				let posY = this.getYPos(idx);

				ElementPosition(elem.id + "_h", posX, posY, 100);
				posX += 65;
				DrawTextFit("h", posX, posY, 100, "Black", "White");
				posX += 75;
				ElementPosition(elem.id + "_m", posX, posY, 100);
				posX += 70;
				DrawTextFit("m", posX, posY, 200, "Black", "White");

				if (disabled){
					ElementSetAttribute(elem.id + "_h", "disabled", "true");
					ElementSetAttribute(elem.id + "_m", "disabled", "true");
				}
				else {
					document.getElementById(elem.id + "_h")?.removeAttribute("disabled");
					document.getElementById(elem.id + "_m")?.removeAttribute("disabled");
				}

				idx += 1;
			}

			//MainCanvas.textAlign = "left";
			//MainCanvas.textAlign = "center";
		}
	}

	Click() {
		// Allowed remote button
		let disabled = (!this.settings.enabled || this.settings.LockedUntil != undefined);
		if (PreferencePageCurrent == 1) {
			if (MouseIn(780, this.getYPos(3)-32, 400, 64)){
				if (!disabled) {
					this.clickAllow();
				}
			}
		}

		super.Click();
	}
}