import { getRandomInt, getCharacter, isBind, isCloth, SendAction, settingsSave } from "utils";
import { BaseState } from "./BaseState";
import { StateModule } from "Modules/states";
import { OutfitOption, SpellDefinition } from "Settings/Models/magic";
import { ItemBundleBaseState } from "./ItemBundleBaseState";

export class SpreadingOutfitState extends ItemBundleBaseState {
    private storedSpellKey: string = "stored-spell";
    get StoredSpell(): SpellDefinition | undefined {
        let ext = this.config.extensions[this.storedSpellKey];
        if (!ext) return undefined;
        try {
            return JSON.parse(LZString.decompressFromBase64(ext));
        }
        catch {
            return undefined;
        }
    }
    private storedSenderNumberKey: string = "stored-sender-number";
    get StoredSenderNumber(): number | undefined {
        let ext = this.config.extensions[this.storedSenderNumberKey];
        if (!ext) return undefined;
        try {
            return JSON.parse(LZString.decompressFromBase64(ext));
        }
        catch {
            return undefined;
        }
    }

    static CleanItemCode(code: string): string {
        let items = JSON.parse(LZString.decompressFromBase64(code)) as ItemBundle[];
        if (!items || !Array.isArray(items))
            return code;
        items = items.filter(item => SpreadingOutfitState.ItemIsAllowed(item));
        return LZString.compressToBase64(JSON.stringify(items));
    }

    static ItemIsAllowed(item: ItemBundle): boolean {
        let asset = AssetGet(Player.AssetFamily, item.Group, item.Name);
        if (!asset)
            return false;
        return SpreadingOutfitState.AssetIsAllowed(asset);
    }

    static AssetIsAllowed(asset: Asset): boolean {
        return isCloth(asset) ||
                isBind(asset, []);
    }

    Type: LSCGState = "spreading-outfit";

    Icon(C: OtherCharacter): string {
        return "Icons/Dress.png";
    }
    Label(C: OtherCharacter): string {
        return "Outfit Spreading";
    }

    constructor(state: StateModule) {
        super(state);
        this.Restrictions.Wardrobe = "true";
    }

    DoChange(asset: Asset | null, spell: SpellDefinition | null): boolean {
        if (!asset)
            return false;
        if (!spell)
            return SpreadingOutfitState.AssetIsAllowed(asset);

        let neckExclusions = Player.LSCG.MagicModule.allowOutfitToChangeNeckItems ? [] : ["ItemNeck", "ItemNeckAccessories", "ItemNeckRestraints"];
        switch(spell.Outfit?.Option) {
            case OutfitOption.clothes_only:
                return isCloth(asset);
            case OutfitOption.binds_only:
                return isBind(asset, neckExclusions);
            case OutfitOption.both:
                return isCloth(asset) || isBind(asset, neckExclusions);
            default:
                return false;
        }
    }

    storeSpreadingOutfitData(outfitListbundle: ServerItemBundle[], originalSpell: SpellDefinition, senderMemberNumber: number | undefined) {
        this.config.extensions[this.storedOutfitKey] = LZString.compressToBase64(JSON.stringify(outfitListbundle));
        this.config.extensions[this.storedSpellKey] = LZString.compressToBase64(JSON.stringify(originalSpell));
        if (!!senderMemberNumber) this.config.extensions[this.storedSenderNumberKey] = LZString.compressToBase64(JSON.stringify(senderMemberNumber));
        settingsSave();
    }

    StripCharacter(skipStore: boolean, spell: SpellDefinition | null, newList: ItemBundle[] = []) {
        //if (!skipStore && !this.StoredOutfit)
        //    this.SetStoredOutfit();

        const cosplayBlocked = Player.OnlineSharedSettings?.BlockBodyCosplay ?? true;
        let appearance = Player.Appearance;
        for (let i = appearance.length - 1; i >= 0; i--) {
            const asset = appearance[i].Asset;
            if (this.DoChange(asset, spell)) {
                if (isCloth(asset) || newList.length == 0 || newList.some(x => x.Group == asset.Group.Name))
                    appearance.splice(i, 1);
            }
        }
    }

    _spreqdingCheck: number = 0;
    _spreqdingInterval: number = 45 * 1000; // 45s spreading interval
    Tick(now: number): void {
        if (this._spreqdingCheck == 0 || this._spreqdingCheck < now) {
            this._spreqdingCheck = now + this._spreqdingInterval;
            if (this.Active && this.StoredOutfit && this.StoredOutfit.length > 0 && this.StoredSpell) {
                let itemList = this.StoredOutfit;
                itemList = this.shuffleArray(itemList);
                this.WearOneMoreItem(itemList, this.StoredSpell, this.StoredSenderNumber);
            }
        }
        super.Tick(now);
    }

    Recover(emote?: boolean | undefined, sender?: Character | null): BaseState {
        if (sender && sender.MemberNumber != this.StoredSenderNumber) {
            SendAction(`%NAME%'s cursed outfit cannot be removed by this character.`);
            return this;
        }
        if (!!this.StoredOutfit) {
            this.ClearStoredOutfit();
        }
        if (emote) SendAction(`%NAME%'s cursed outfit finished spreading and it's now drained of all its energy.`);
        super.Recover();
        return this;
    }

    Apply(spell: SpellDefinition, memberNumber?: number | undefined, duration?: number, emote?: boolean | undefined): BaseState {
        try{
            let outfit = spell.Outfit;
            if (!!outfit) {
                let outfitList = this.GetConfiguredItemBundles(outfit.Code, item => SpreadingOutfitState.ItemIsAllowed(item));
                if (!!outfitList && typeof outfitList == "object") {
                    this._spreqdingCheck = 0;
                    this.storeSpreadingOutfitData(outfitList, spell, memberNumber);
                    // TODO: test if the worn item have the correct property (might be dangerous if sanitize ?)
                    super.Activate(memberNumber, duration, emote);
                }
            }
        }
        catch {
            console.warn("error parsing outfitcode in SpreadingOutfitState: " + spell.Outfit?.Code);
        }
        return this;
    }

    WearOneMoreItem(outfitListbundle: ServerItemBundle[], spell: SpellDefinition, memberNumber: number | undefined = undefined) {
        if (!memberNumber)
            memberNumber = Player.MemberNumber ?? 0;
        let sender = !!memberNumber ? getCharacter(memberNumber) : null;
        let index = this.selectNextItem(outfitListbundle, spell, sender);
        if (index >= 0) {
            let item = outfitListbundle[index];

            let newItem = InventoryWear(Player, item.Name, item.Group, item.Color, item.Difficulty, -1, item.Craft, false);
            if (!!newItem) {
                if (!!item.Property)
                    newItem.Property = item.Property;
                let itemName = (newItem?.Craft?.Name ?? newItem.Asset.Name);
                SendAction(`%NAME%'s cursed outfit is spreading, adding ${itemName}.`);
                ChatRoomCharacterUpdate(Player);
            }
        }
        else {
            this.Recover(true);
        }
    }

    selectNextItem(items: ItemBundle[], spell: SpellDefinition, sender: Character | null) {
        let i = 0;
        // Do all clothes 1st (tmp disabled)
        let priority: "cloth" | "bind" = "cloth";
        while (i < items.length) {
            let item = items[i];
            let asset = AssetGet(Player.AssetFamily, item.Group, item.Name);
            //let shouldSkipBind = (priority == "cloth" && asset && isBind(asset));
            let shouldSkipBind = false;
            let itemIsAllowed = this.DoChange(asset, spell);
            let isBlocked = asset && this.InventoryBlockedOrLimited(sender, {Asset: asset});
            let isRoomDisallowed = !InventoryChatRoomAllow(asset?.Category ?? []);
            let itemAlreadyWorn = InventoryIsItemInList(Player, item.Group, [item.Name]);
            if (itemAlreadyWorn || shouldSkipBind || itemIsAllowed == false || isBlocked || isRoomDisallowed) {
                i++;
                // Do all bind after clothes are done (disabled)
                if (i == items.length && priority == "cloth") {
                    i = 0;
                    priority = "bind";
                }
                continue;
            }

            // If we get here then this the next item to use!
            return i;
        }
        return -1;
    }

    shuffleArray(array: any): any {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
          }
          return array;
    }

    WearMany(items: ItemBundle[], spell: SpellDefinition, isRestore: boolean = false, memberNumber: number | undefined = undefined) {
        if (!memberNumber)
            memberNumber = Player.MemberNumber ?? 0;
        let sender = !!memberNumber ? getCharacter(memberNumber) : null;
        items.forEach(item => {
            let asset = AssetGet(Player.AssetFamily, item.Group, item.Name);
            if (!!asset && this.DoChange(asset, spell)) {
                let isBlocked = this.InventoryBlockedOrLimited(sender, {Asset: asset});
                let isRoomDisallowed = !InventoryChatRoomAllow(asset?.Category ?? []);
                if (isRestore || !(isBlocked || isRoomDisallowed)) {
                    let newItem = InventoryWear(Player, item.Name, item.Group, item.Color, item.Difficulty, -1, item.Craft, false);
                    if (!!newItem) {
                        if (!!item.Property)
                            newItem.Property = item.Property;
                    }
                }
            }
        });
        ChatRoomCharacterUpdate(Player);
    }

    Init(): void {}

    RoomSync(): void {}

    SpeechBlock(): void {}
}