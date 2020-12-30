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

public class BlueShareSoundObjectCategory {
    private final int categoryId;

    private final String name;

    private final String description;

    private final BlueShareSoundObjectCategory[] subcategories;

    public BlueShareSoundObjectCategory(int categoryId, String name,
            String description, BlueShareSoundObjectCategory[] subcategories) {
        this.categoryId = categoryId;
        this.name = name;
        this.description = description;
        this.subcategories = subcategories;
    }

    public int getCategoryId() {
        return categoryId;
    }

    public String getDescription() {
        return description;
    }

    public String getName() {
        return name;
    }

    @Override
    public String toString() {
        return this.name;
    }

    public BlueShareSoundObjectCategory[] getSubCategories() {
        return this.subcategories;
    }

}