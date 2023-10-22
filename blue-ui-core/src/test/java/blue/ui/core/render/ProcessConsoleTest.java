/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
 * Steven Yi <stevenyi@gmail.com>
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
package blue.ui.core.render;

import org.junit.Test;

/**
 *
 * @author stevenyi
 */
public class ProcessConsoleTest {
    
    public ProcessConsoleTest() {
    }

//    /**
//     * Test of toString method, of class ProcessConsole.
//     */
//    @Test
//    public void testToString() {
//        System.out.println("toString");
//        ProcessConsole instance = new ProcessConsole();
//        String expResult = "";
//        String result = instance.toString();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of addPlayModeListener method, of class ProcessConsole.
//     */
//    @Test
//    public void testAddPlayModeListener() {
//        System.out.println("addPlayModeListener");
//        PlayModeListener listener = null;
//        ProcessConsole instance = new ProcessConsole();
//        instance.addPlayModeListener(listener);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of removePlayModeListener method, of class ProcessConsole.
//     */
//    @Test
//    public void testRemovePlayModeListener() {
//        System.out.println("removePlayModeListener");
//        PlayModeListener listener = null;
//        ProcessConsole instance = new ProcessConsole();
//        instance.removePlayModeListener(listener);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of notifyPlayModeListeners method, of class ProcessConsole.
//     */
//    @Test
//    public void testNotifyPlayModeListeners() {
//        System.out.println("notifyPlayModeListeners");
//        int playMode = 0;
//        ProcessConsole instance = new ProcessConsole();
//        instance.notifyPlayModeListeners(playMode);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of execWait method, of class ProcessConsole.
//     */
//    @Test
//    public void testExecWait_String_File() throws Exception {
//        System.out.println("execWait");
//        String commandLine = "";
//        File currentWorkingDirectory = null;
//        ProcessConsole instance = new ProcessConsole();
//        instance.execWait(commandLine, currentWorkingDirectory);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of renderToDisk method, of class ProcessConsole.
//     */
//    @Test
//    public void testRenderToDisk() {
//        System.out.println("renderToDisk");
//        DiskRenderJob job = null;
//        ProcessConsole instance = new ProcessConsole();
//        instance.renderToDisk(job);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of splitCommandString method, of class ProcessConsole.
//     */
//    @Test
//    public void testSplitCommandString() {
//        System.out.println("splitCommandString");
//        String in = "";
//        String[] expResult = null;
//        String[] result = ProcessConsole.splitCommandString(in);
//        assertArrayEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of isRunning method, of class ProcessConsole.
//     */
//    @Test
//    public void testIsRunning() {
//        System.out.println("isRunning");
//        ProcessConsole instance = new ProcessConsole();
//        boolean expResult = false;
//        boolean result = instance.isRunning();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of stop method, of class ProcessConsole.
//     */
//    @Test
//    public void testStop() {
//        System.out.println("stop");
//        ProcessConsole instance = new ProcessConsole();
//        instance.stop();
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of destroy method, of class ProcessConsole.
//     */
//    @Test
//    public void testDestroy_boolean() {
//        System.out.println("destroy");
//        boolean notifyListeners = false;
//        ProcessConsole instance = new ProcessConsole();
//        instance.destroy(notifyListeners);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of destroy method, of class ProcessConsole.
//     */
//    @Test
//    public void testDestroy_boolean_boolean() {
//        System.out.println("destroy");
//        boolean notifyListeners = false;
//        boolean killProcess = false;
//        ProcessConsole instance = new ProcessConsole();
//        instance.destroy(notifyListeners, killProcess);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of passToStdin method, of class ProcessConsole.
//     */
//    @Test
//    public void testPassToStdin() {
//        System.out.println("passToStdin");
//        String text = "";
//        ProcessConsole instance = new ProcessConsole();
//        instance.passToStdin(text);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of getCollectedOutput method, of class ProcessConsole.
//     */
//    @Test
//    public void testGetCollectedOutput() {
//        System.out.println("getCollectedOutput");
//        ProcessConsole instance = new ProcessConsole();
//        String expResult = "";
//        String result = instance.getCollectedOutput();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of execWait method, of class ProcessConsole.
//     */
//    @Test
//    public void testExecWait_5args() {
//        System.out.println("execWait");
//        String[] args = null;
//        File currentWorkingDirectory = null;
//        float startTime = 0.0F;
//        TempoMapper mapper = null;
//        ArrayList<Parameter> parameters = null;
//        ProcessConsole instance = new ProcessConsole();
//        instance.execWait(args, currentWorkingDirectory, startTime, mapper,
//                parameters);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of execWaitAndCollect method, of class ProcessConsole.
//     */
//    @Test
//    public void testExecWaitAndCollect() {
//        System.out.println("execWaitAndCollect");
//        String[] args = null;
//        File currentWorkingDirectory = null;
//        ProcessConsole instance = new ProcessConsole();
//        String expResult = "";
//        String result = instance.execWaitAndCollect(args,
//                currentWorkingDirectory);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of setRenderTimeManager method, of class ProcessConsole.
//     */
//    @Test
//    public void testSetRenderTimeManager() {
//        System.out.println("setRenderTimeManager");
//        RenderTimeManager renderTimeManager = null;
//        ProcessConsole instance = new ProcessConsole();
//        instance.setRenderTimeManager(renderTimeManager);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of getLastExitValue method, of class ProcessConsole.
//     */
//    @Test
//    public void testGetLastExitValue() {
//        System.out.println("getLastExitValue");
//        ProcessConsole instance = new ProcessConsole();
//        int expResult = 0;
//        int result = instance.getLastExitValue();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

    @Test
    public void testGetCsoundVersion() {
        
    }
}