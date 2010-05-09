package blue.tools.blueShare;

import java.awt.BorderLayout;
import java.awt.Frame;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;

import javax.swing.JDialog;
import javax.swing.JTabbedPane;

import blue.BlueSystem;
import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.tools.blueShare.effects.BlueShareEffectCategory;
import blue.tools.blueShare.effects.EffectExportPane;
import blue.tools.blueShare.effects.EffectImportPane;
import blue.tools.blueShare.effects.EffectManagementPane;
import blue.tools.blueShare.instruments.BlueShareInstrumentCategory;
import blue.tools.blueShare.instruments.InstrumentExportPane;
import blue.tools.blueShare.instruments.InstrumentImportPane;
import blue.tools.blueShare.instruments.InstrumentManagementPane;
import blue.utility.GUI;
import electric.xml.Element;

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

public class BlueShareDialog extends JDialog implements WindowSettingsSavable {

    InstrumentImportPane iPane = new InstrumentImportPane();

    InstrumentExportPane iExportPane = new InstrumentExportPane();

    EffectImportPane ePane = new EffectImportPane();

    EffectExportPane eExportPane = new EffectExportPane();

    public BlueShareDialog(Frame parent, boolean modal) {
        super(parent, modal);

        this.setTitle(".: Blue Share :.");
        this.getContentPane().setLayout(new BorderLayout());

        JTabbedPane instrumentTabs = getInstrumentPane();
        JTabbedPane effectTabs = getEffectsPane();

        JTabbedPane tabs = new JTabbedPane();
        tabs.add("Instruments", instrumentTabs);
        tabs.add("Effects", effectTabs);

        this.getContentPane().add(tabs);

        this.addComponentListener(new ComponentAdapter() {

            public void componentHidden(ComponentEvent e) {
                dispose();
            }
        });

        setSize(800, 600);
        GUI.centerOnScreen(this);

        WindowSettingManager.getInstance().registerWindow("BlueShareDialog",
                this);
    }

    public void setInstrumentCategories(BlueShareInstrumentCategory[] categories) {
        iPane.setCategories(categories);
        iExportPane.setCategories(categories);
    }

    public void setEffectCategories(BlueShareEffectCategory[] effectCategories) {
        ePane.setCategories(effectCategories);
        eExportPane.setCategories(effectCategories);
    }

    /**
     * @param categories
     * @return
     */
    private JTabbedPane getInstrumentPane() {

        InstrumentManagementPane iManagePane = new InstrumentManagementPane();

        JTabbedPane tabs = new JTabbedPane();
        tabs.add(BlueSystem.getString("common.import"), iPane);
        tabs.add(BlueSystem.getString("common.export"), iExportPane);
        tabs.add(BlueSystem.getString("common.manage"), iManagePane);
        return tabs;
    }

    /**
     * @param categories
     * @return
     */
    private JTabbedPane getEffectsPane() {

        EffectManagementPane eManagePane = new EffectManagementPane();

        JTabbedPane tabs = new JTabbedPane();
        tabs.add(BlueSystem.getString("common.import"), ePane);
        tabs.add(BlueSystem.getString("common.export"), eExportPane);
        tabs.add(BlueSystem.getString("common.manage"), eManagePane);
        return tabs;
    }

    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);
    }

    public Element saveWindowSettings() {
        return WindowSettingManager.getBasicSettings(this);
    }
}