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

public class BlueShareEffectCategory {
    private int categoryId;

    private String name;

    private String description;

    private BlueShareEffectCategory[] subcategories;

    public BlueShareEffectCategory(int categoryId, String name,
            String description, BlueShareEffectCategory[] subcategories) {
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

    public String toString() {
        return this.name;
    }

    public BlueShareEffectCategory[] getSubCategories() {
        return this.subcategories;
    }

}