package blue.tools.blueShare.effects;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class EffectOption {
    private int instrumentId;

    private String screenName, name, description, category;

    public EffectOption(int instrumentId, String screenName, String name,
            String description, String category) {
        this.instrumentId = instrumentId;
        this.screenName = screenName;
        this.name = name;
        this.description = description;
        this.category = category;
    }

    public String getScreenName() {
        return screenName;
    }

    public String getDescription() {
        return description;
    }

    public int getInstrumentId() {
        return instrumentId;
    }

    public String getName() {
        return name;
    }

    public String getCategory() {
        return category;
    }

}