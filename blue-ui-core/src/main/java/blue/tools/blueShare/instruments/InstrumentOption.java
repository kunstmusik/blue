package blue.tools.blueShare.instruments;

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

public class InstrumentOption {
    private int instrumentId;

    private String screenName, name, type, description, category;

    public InstrumentOption(int instrumentId, String screenName, String name,
            String type, String description, String category) {
        this.instrumentId = instrumentId;
        this.screenName = screenName;
        this.name = name;
        this.type = type;
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

    public String getType() {
        return type;
    }

    public String getCategory() {
        return category;
    }

}