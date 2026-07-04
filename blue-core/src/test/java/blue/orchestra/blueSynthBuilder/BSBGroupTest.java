/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.orchestra.blueSynthBuilder;

import blue.automation.Parameter;
import blue.automation.ParameterList;
import blue.automation.ParameterTimeManagerFactory;
import blue.components.lines.LinePoint;
import java.util.ArrayList;
import java.util.HashSet;
import javafx.collections.FXCollections;
import javafx.collections.ObservableSet;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

/**
 *
 * @author stevenyi
 */
class BSBGroupTest {
    
//    /**
//     * Test of getNames method, of class BSBGroup.
//     */
//    @Test
//    public void testGetNames() {
//        System.out.println("getNames");
//        BSBGroup instance = new BSBGroup();
//        Set<String> expResult = null;
//        Set<String> result = instance.getNames();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of loadFromXML method, of class BSBGroup.
//     */
//    @Test
//    public void testLoadFromXML() throws Exception {
//        System.out.println("loadFromXML");
//        Element data = null;
//        BSBGroup expResult = null;
//        BSBGroup result = BSBGroup.loadFromXML(data);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

//    /**
//     * Test of saveAsXML method, of class BSBGroup.
//     */
//    @Test
//    public void testSaveAsXML() {
//        System.out.println("saveAsXML");
//        BSBGroup instance = new BSBGroup();
//        Element expResult = null;
//        Element result = instance.saveAsXML();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of getPresetValue method, of class BSBGroup.
//     */
//    @Test
//    public void testGetPresetValue() {
//        System.out.println("getPresetValue");
//        BSBGroup instance = new BSBGroup();
//        String expResult = "";
//        String result = instance.getPresetValue();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

//    /**
//     * Test of deepCopy method, of class BSBGroup.
//     */
//    @Test
//    public void testDeepCopy() {
//        System.out.println("deepCopy");
//        BSBGroup instance = new BSBGroup();
//        BSBObject expResult = null;
//        BSBObject result = instance.deepCopy();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

    /**
     * Test of setUniqueNameManager method, of class BSBGroup.
     */
    @Test
    void testSetUniqueNameManager() {
        BSBGroup root = new BSBGroup();
        BSBGroup subNode = new BSBGroup();
        BSBFileSelector fs = new BSBFileSelector();
        BSBFileSelector fs2 = new BSBFileSelector();
        fs.setObjectName("fs");
        fs2.setObjectName("fs1");

        root.addBSBObject(subNode);
        subNode.addBSBObject(fs);
        subNode.addBSBObject(fs2);

        UniqueNameManager unm = new UniqueNameManager();
        unm.setUniqueNameCollection(root);
        root.setUniqueNameManager(unm);

        assertEquals("fs", fs.getObjectName());
        assertEquals("fs1", fs2.getObjectName());

        BSBFileSelector fs3 = (BSBFileSelector) fs2.deepCopy();
        root.addBSBObject(fs3);
        
        assertEquals("fs2", fs3.getObjectName());
        BSBGroup subNode2 = (BSBGroup) subNode.deepCopy();
        root.addBSBObject(subNode2);

        assertEquals(2, subNode2.interfaceItemsProperty().size());

        for(BSBObject bsbObj : subNode2.interfaceItemsProperty()) {
            String objName = bsbObj.getObjectName();
            assertTrue(objName.equals("fs3") || objName.equals("fs4"));
        }
    }

    /**
     * Test of resetSubChannels method, of class BSBGroup.
     */
    @Test
    void testResetSubChannels() {
        BSBGroup root = new BSBGroup();
        BSBGroup subNode = new BSBGroup();
        BSBSubChannelDropdown sub1 = new BSBSubChannelDropdown();
        BSBSubChannelDropdown sub2 = new BSBSubChannelDropdown();
        sub1.setChannelOutput("TEST1");
        sub2.setChannelOutput("TEST2");
        root.addBSBObject(sub1);
        subNode.addBSBObject(sub2);
        root.addBSBObject(subNode);
        root.resetSubChannels();

        assertEquals("Master", sub1.getChannelOutput());
        assertEquals("Master", sub2.getChannelOutput());
    }

    /**
     * Test of getStringChannels method, of class BSBGroup.
     */
    @Test
    void testGetStringChannels() {
        BSBGroup root = new BSBGroup();
        BSBGroup subNode = new BSBGroup();
        BSBFileSelector fs = new BSBFileSelector();
        BSBFileSelector fs2 = new BSBFileSelector();
        fs.setObjectName("fs");
        fs2.setObjectName("fs2");
        root.addBSBObject(fs);
        root.addBSBObject(subNode);
        subNode.addBSBObject(fs2);
        ArrayList<StringChannel> stringChannels = new ArrayList<>();
        root.getStringChannels(stringChannels);
        assertEquals(2, stringChannels.size());
        assertTrue(stringChannels.contains(fs.getStringChannel()));
        assertTrue(stringChannels.contains(fs2.getStringChannel()));
    }

    /**
     * Test of setParameterList method, of class BSBGroup.
     */
    @Test
    void testSetParameterList() {
        System.out.println("setParameterList");
        ParameterList paramList = new ParameterList();
        BSBGroup instance = new BSBGroup();
        instance.setUniqueNameManager(new UniqueNameManager());
        instance.setAllSet(FXCollections.observableSet(new HashSet<>()));
        instance.setParameterList(paramList);
        BSBKnob knob = new BSBKnob();
        knob.setObjectName("test1");

        instance.addBSBObject(knob);
        assertEquals(1, paramList.size());

        instance.interfaceItemsProperty().remove(knob);
        assertEquals(0, paramList.size());
        assertFalse(knob.isAutomationAllowed());

        BSBGroup subNode = new BSBGroup();
        subNode.addBSBObject(knob);
        knob.setAutomationAllowed(true);

        instance.addBSBObject(subNode);
        assertEquals(1, paramList.size());

        subNode.interfaceItemsProperty().remove(knob);
        assertEquals(0, paramList.size());
        assertFalse(knob.isAutomationAllowed());

        knob.setAutomationAllowed(true);
        subNode.addBSBObject(knob);
        assertEquals(1, paramList.size());

        instance.interfaceItemsProperty().remove(subNode);
        assertEquals(0, paramList.size());
        assertFalse(knob.isAutomationAllowed());
    }

    @Test
    void testGroupUngroupPreservesTimelineAutomationParameter() {
        ParameterList paramList = new ParameterList();
        BSBGroup root = new BSBGroup();
        root.setAllSet(FXCollections.observableSet(new HashSet<>()));
        root.setParameterList(paramList);

        BSBKnob knob = new BSBKnob();
        knob.setObjectName("test1");
        knob.setAutomationAllowed(true);
        root.addBSBObject(knob);

        assertEquals(1, paramList.size());

        Parameter parameter = paramList.getParameter("test1");
        parameter.setAutomationEnabled(true);
        LinePoint linePoint = new LinePoint();
        linePoint.setLocation(1.0, 0.75);
        parameter.getLine().insertLinePoint(linePoint);

        BSBGroup group = new BSBGroup();
        assertTrue(root.moveBSBObjectTo(knob, group));
        root.addBSBObject(group);

        assertSame(parameter, paramList.getParameter("test1"));
        assertEquals(1, paramList.size());
        assertTrue(knob.isAutomationAllowed());
        assertTrue(parameter.isAutomationEnabled());
        assertEquals(2, parameter.getLine().size());

        assertTrue(group.moveBSBObjectTo(knob, root));
        assertTrue(root.interfaceItemsProperty().remove(group));

        assertSame(parameter, paramList.getParameter("test1"));
        assertEquals(1, paramList.size());
        assertTrue(knob.isAutomationAllowed());
        assertTrue(parameter.isAutomationEnabled());
        assertEquals(2, parameter.getLine().size());

        var previousTimeManager = ParameterTimeManagerFactory.getInstance();
        ParameterTimeManagerFactory.setInstance(() -> -1.0);
        knob.setValue(0.25);
        ParameterTimeManagerFactory.setInstance(() -> 1.0);
        try {
            parameter.fireUpdateFromTimeChange();
            assertEquals(0.75, knob.getValue(), 0.0001);
        } finally {
            ParameterTimeManagerFactory.setInstance(previousTimeManager);
        }
    }

    @Test
    void testGroupUngroupKeepsAutomationDisabledWithoutCreatingParameter() {
        ParameterList paramList = new ParameterList();
        BSBGroup root = new BSBGroup();
        root.setAllSet(FXCollections.observableSet(new HashSet<>()));
        root.setParameterList(paramList);

        BSBKnob knob = new BSBKnob();
        knob.setObjectName("test1");
        knob.setAutomationAllowed(false);
        root.addBSBObject(knob);

        assertFalse(knob.isAutomationAllowed());
        assertEquals(0, paramList.size());

        BSBGroup group = new BSBGroup();
        assertTrue(root.moveBSBObjectTo(knob, group));
        root.addBSBObject(group);

        assertFalse(knob.isAutomationAllowed());
        assertEquals(0, paramList.size());

        assertTrue(group.moveBSBObjectTo(knob, root));
        assertTrue(root.interfaceItemsProperty().remove(group));

        assertFalse(knob.isAutomationAllowed());
        assertEquals(0, paramList.size());
    }

    @Test
    void testGroupUngroupPreservesMultiParameterWidgetAutomation() {
        ParameterList paramList = new ParameterList();
        BSBGroup root = new BSBGroup();
        root.setAllSet(FXCollections.observableSet(new HashSet<>()));
        root.setParameterList(paramList);

        BSBXYController xyController = new BSBXYController();
        xyController.setObjectName("xy");
        xyController.setAutomationAllowed(true);
        root.addBSBObject(xyController);

        assertEquals(2, paramList.size());

        Parameter xParameter = paramList.getParameter("xyX");
        Parameter yParameter = paramList.getParameter("xyY");
        xParameter.setAutomationEnabled(true);
        yParameter.setAutomationEnabled(true);

        LinePoint xLinePoint = new LinePoint();
        xLinePoint.setLocation(1.0, 0.25);
        xParameter.getLine().insertLinePoint(xLinePoint);

        LinePoint yLinePoint = new LinePoint();
        yLinePoint.setLocation(1.0, 0.75);
        yParameter.getLine().insertLinePoint(yLinePoint);

        BSBGroup group = new BSBGroup();
        assertTrue(root.moveBSBObjectTo(xyController, group));
        root.addBSBObject(group);

        assertSame(xParameter, paramList.getParameter("xyX"));
        assertSame(yParameter, paramList.getParameter("xyY"));
        assertEquals(2, paramList.size());
        assertTrue(xyController.isAutomationAllowed());
        assertTrue(xParameter.isAutomationEnabled());
        assertTrue(yParameter.isAutomationEnabled());
        assertEquals(2, xParameter.getLine().size());
        assertEquals(2, yParameter.getLine().size());

        assertTrue(group.moveBSBObjectTo(xyController, root));
        assertTrue(root.interfaceItemsProperty().remove(group));

        assertSame(xParameter, paramList.getParameter("xyX"));
        assertSame(yParameter, paramList.getParameter("xyY"));
        assertEquals(2, paramList.size());
        assertTrue(xyController.isAutomationAllowed());
        assertTrue(xParameter.isAutomationEnabled());
        assertTrue(yParameter.isAutomationEnabled());
        assertEquals(2, xParameter.getLine().size());
        assertEquals(2, yParameter.getLine().size());

        var previousTimeManager = ParameterTimeManagerFactory.getInstance();
        xyController.setXValue(0.5);
        xyController.setYValue(0.5);
        ParameterTimeManagerFactory.setInstance(() -> 1.0);
        try {
            xParameter.fireUpdateFromTimeChange();
            yParameter.fireUpdateFromTimeChange();
            assertEquals(0.25, xyController.getXValue(), 0.0001);
            assertEquals(0.75, xyController.getYValue(), 0.0001);
        } finally {
            ParameterTimeManagerFactory.setInstance(previousTimeManager);
        }
    }

    @Test
    void testNestedGroupMovePreservesTimelineAutomationParameter() {
        ParameterList paramList = new ParameterList();
        BSBGroup root = new BSBGroup();
        root.setAllSet(FXCollections.observableSet(new HashSet<>()));
        root.setParameterList(paramList);

        BSBGroup childGroup = new BSBGroup();
        BSBKnob knob = new BSBKnob();
        knob.setObjectName("test1");
        knob.setAutomationAllowed(true);
        childGroup.addBSBObject(knob);
        root.addBSBObject(childGroup);

        assertEquals(1, paramList.size());

        Parameter parameter = paramList.getParameter("test1");
        parameter.setAutomationEnabled(true);
        LinePoint linePoint = new LinePoint();
        linePoint.setLocation(1.0, 0.75);
        parameter.getLine().insertLinePoint(linePoint);

        BSBGroup parentGroup = new BSBGroup();
        assertTrue(root.moveBSBObjectTo(childGroup, parentGroup));
        root.addBSBObject(parentGroup);

        assertSame(parameter, paramList.getParameter("test1"));
        assertEquals(1, paramList.size());
        assertTrue(knob.isAutomationAllowed());
        assertTrue(parameter.isAutomationEnabled());
        assertEquals(2, parameter.getLine().size());

        assertTrue(parentGroup.moveBSBObjectTo(childGroup, root));
        assertTrue(root.interfaceItemsProperty().remove(parentGroup));

        assertSame(parameter, paramList.getParameter("test1"));
        assertEquals(1, paramList.size());
        assertTrue(knob.isAutomationAllowed());
        assertTrue(parameter.isAutomationEnabled());
        assertEquals(2, parameter.getLine().size());
    }

    /**
     * Test of setAllSet method, of class BSBGroup.
     */
    @Test
    void testSetAllSet() {
        BSBGroup root = new BSBGroup();
        BSBGroup subNode = new BSBGroup();
        BSBFileSelector fs = new BSBFileSelector();
        BSBFileSelector fs2 = new BSBFileSelector();
        fs.setObjectName("fs");
        fs2.setObjectName("fs2");
        root.addBSBObject(fs);
        root.addBSBObject(subNode);
        subNode.addBSBObject(fs2);

        ObservableSet<BSBObject> allSet = FXCollections.observableSet(
                new HashSet<>());

        root.setAllSet(allSet);

        assertEquals(4, allSet.size());
        assertTrue(allSet.contains(root));
        assertTrue(allSet.contains(subNode));
        assertTrue(allSet.contains(fs));
        assertTrue(allSet.contains(fs2));

        BSBKnob knob = new BSBKnob();
        BSBKnob knob2 = new BSBKnob();
        root.addBSBObject(knob);
        subNode.addBSBObject(knob2);
        
        assertEquals(6, allSet.size());
        assertTrue(allSet.contains(knob));
        assertTrue(allSet.contains(knob2));

        BSBGroup subNode2 = new BSBGroup();
        BSBKnob knob3 = new BSBKnob();
        BSBKnob knob4 = new BSBKnob();
        subNode2.addBSBObject(knob3);
        subNode2.addBSBObject(knob4);

        root.addBSBObject(subNode2);

        assertEquals(9, allSet.size());
        assertTrue(allSet.contains(subNode2));
        assertTrue(allSet.contains(knob3));
        assertTrue(allSet.contains(knob4));

        root.interfaceItemsProperty().remove(subNode2);

        assertEquals(6, allSet.size());
        assertTrue(!allSet.contains(subNode2));
        assertTrue(!allSet.contains(knob3));
        assertTrue(!allSet.contains(knob4));
    }
    
}
