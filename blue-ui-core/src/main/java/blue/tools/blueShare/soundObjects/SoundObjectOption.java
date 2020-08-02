package blue.tools.blueShare.soundObjects;

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

public class SoundObjectOption {
    private final int soundObjectId;

    private final String screenName;
    private final String name;
    private final String type;
    private final String description;
    private final String category;

    public SoundObjectOption(int soundObjectId, String screenName, String name,
            String type, String description, String category) {
        this.soundObjectId = soundObjectId;
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

    public int getSoundObjectId() {
        return soundObjectId;
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