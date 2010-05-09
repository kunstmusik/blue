/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject.ceciliaModule.cybil;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.StringTokenizer;

import blue.BlueSystem;
import blue.soundObject.CeciliaModule;
import blue.soundObject.ceciliaModule.CGraph;
//import blue.soundObject.editor.ceciliaModule.CeciliaModuleImportDialog;
import blue.utility.TextUtilities;

/**
 * @author steven
 * 
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */
public class CybilCompiler {

    public static String compile(String cybilScore, CeciliaModule cm) {
        StringBuffer buffer = new StringBuffer();
        StringTokenizer st = new StringTokenizer(cybilScore, "\n");

        // NoteList nl = new NoteList();

        while (st.hasMoreTokens()) {
            String line = stripComments(st.nextToken());

            if (line.startsWith("instr")) {
                line = line.substring(5);

                StringTokenizer instrIds = new StringTokenizer(line);

                StringBuffer instrBuffer = new StringBuffer();
                String instrLine;

                while (!(instrLine = st.nextToken()).equals("e")) {
                    String cleanLine = stripComments(instrLine);

                    if (cleanLine.length() > 0) {
                        instrBuffer.append(cleanLine).append("\n");
                    }
                }

                String instrBody = instrBuffer.toString();

                while (instrIds.hasMoreTokens()) {
                    String instrumentId = instrIds.nextToken();
                    buffer
                            .append(compileInstrument(instrumentId, instrBody,
                                    cm));
                }

            } else {
                buffer.append(line).append("\n");
            }

        }

        return buffer.toString();
    }

    private static String stripComments(final String line) {
        int index = line.indexOf(";");

        String retVal = line;

        if (index > -1) {
            retVal = retVal.substring(0, index);
        }

        return retVal.trim();
    }

    /**
     * @param instrumentId
     * @param instrBody
     * @param cm
     * @return
     */
    private static String compileInstrument(String instrumentId,
            String instrBody, CeciliaModule cm) {
        // p2 creates the list of notes
        // all others build of that note list

        // NoteList nl = new NoteList();
        String line;

        // System.err.println("Cybil: instr " + instrumentId + "\n" +
        // instrBody);

        StringTokenizer st = new StringTokenizer(instrBody, "\n");

        int numPfields = st.countTokens() + 1;

        // System.out.println("num pfields: " + numPfields);

        CybilNoteList cybNoteList = new CybilNoteList();

        cybNoteList.instrumentId = instrumentId;
        cybNoteList.numPfields = numPfields;

        while (st.hasMoreTokens()) {
            line = st.nextToken();
            line = TextUtilities.replaceAll(line, "\t", " ");
            int pField = getPField(line);

            ArrayList commands = splitCommands(line);
            // String commandBody = getCommand(line);

            // System.out.println(">> Pfield: " + pField);

            cybNoteList.pfield = pField;
            cybNoteList.index = 0;

            int startIndex = 0;
            int endIndex = 0;

            for (Iterator iter = commands.iterator(); iter.hasNext();) {
                String command = (String) iter.next();

                if (isOperator(command)) {
                    System.out.println("Operator found: " + command);

                    String nextCommand = (String) iter.next();

                    CybilArg arg = compileArg(cybNoteList, nextCommand, cm);

                    CybilOperator.process(command, cybNoteList, startIndex,
                            endIndex, arg);

                } else {
                    startIndex = cybNoteList.index;
                    processCommand(cybNoteList, command, cm);
                    endIndex = cybNoteList.index;
                }
            }

        }

        return cybNoteList.notes.toString();
    }

    /**
     * @param line
     * @return
     */
    private static ArrayList splitCommands(String line) {
        ArrayList commands = new ArrayList();

        int counter = 0;
        int index = 0;
        int firstBrace = 0;

        while (index < line.length()) {

            char c = line.charAt(index);

            if (c == '{') {

                if (counter == 0) {
                    firstBrace = index;
                }
                counter++;

            } else if (c == '}') {

                counter--;

                if (counter == 0) {
                    commands.add(line.substring(firstBrace, index + 1));
                }

            } else if (isOperator(c)) {
                if (counter == 0) {
                    commands.add(c + "");
                }
            }

            index++;
        }

        // System.out.println("line: " + line);

        // for(Iterator iter = commands.iterator(); iter.hasNext();) {
        // String element = (String) iter.next();
        // System.out.println("Command: " + element);
        // }

        return commands;
    }

    /**
     * @param c
     * @return
     */
    private static boolean isOperator(char c) {
        return isOperator(Character.toString(c));
    }

    private static boolean isOperator(String c) {
        if (c.length() != 1) {
            return false;
        }

        return (c.equals("+") || c.equals("-") || c.equals("*") || c
                .equals("/"));
    }

    /**
     * @param cm
     * @param nl
     * @param pfield
     * @param string
     */
    private static void processCommand(CybilNoteList cybNoteList,
            String commandBody, CeciliaModule cm) {

        // System.out.println("Command Body: " + commandBody);
        CybilArg arg = compileArg(cybNoteList, commandBody, cm);

        arg.getValue(cybNoteList);

    }

    /* UTILITY FUNCTIONS */

    /**
     * @param cybNoteList
     * @param commandBody
     * @return
     */
    private static CybilArg compileArg(CybilNoteList cybNoteList,
            String commandBody, CeciliaModule cm) {
        String spacedLine = spaceLine(commandBody);

        StringTokenizer st = new StringTokenizer(spacedLine);

        String[] tokens = new String[st.countTokens()];

        for (int i = 0; st.hasMoreTokens(); i++) {
            tokens[i] = st.nextToken();
        }

        CybilNode node = new CybilNode();

        parseNodes(node, tokens, 1);

        CybilArg arg = compileNode(node, cybNoteList, cm);
        return arg;
    }

    /**
     * @param node
     * @param pfield
     * @param nl
     * @return
     */
    private static CybilArg compileNode(CybilNode node,
            CybilNoteList cybNoteList, CeciliaModule cm) {
        ArrayList args = node.args;

        CybilArg retArg = null;

        retArg = createCybilArg((String) args.get(0));

        if (retArg != null) {

            for (int i = 1; i < args.size(); i++) {
                Object obj = args.get(i);
                if (obj instanceof CybilNode) {
                    retArg.args.add(compileNode((CybilNode) obj, cybNoteList,
                            cm));
                } else {
                    retArg.args.add(obj);
                }
            }

            if (retArg instanceof gr) {
                String graphName = (String) retArg.args.get(0);
                CGraph cGraph = (CGraph) cm.getStateData().get(graphName);
                ((gr) retArg).setCGraph(cGraph);
            }
        }

        return retArg;

    }

    /**
     * @param string
     * @return
     */
    private static CybilArg createCybilArg(String argName) {
        if (argName.equals("sq")) {
            return new sq();
        } else if (argName.equals("li")) {
            return new li();
        } else if (argName.equals("lo")) {
            return new lo();
        } else if (argName.equals("ma")) {
            return new ma();
        } else if (argName.equals("gr")) {
            return new gr();
        } else if (argName.equals("ran")) {
            return new ran();
        } else if (argName.equals("pik")) {
            return new pik();
        } else if (argName.equals("pa")) {
            return new pa();
        } else if (argName.equals("co")) {
            return new co();
        }

        String errMessage = "[" + BlueSystem.getString("message.error")
                + "] - " + BlueSystem.getString("common.noClassFound") + " ";

        System.err.println(errMessage + argName);

        return null;

    }

    /**
     * @param node
     * @param tokens
     * @param i
     */
    private static int parseNodes(CybilNode node, String[] tokens, int index) {
        int i = index;
        while (!tokens[i].equals("}") && i < tokens.length) {
            if (tokens[i].equals("{")) {
                CybilNode newNode = new CybilNode();
                node.args.add(newNode);
                int newIndex = parseNodes(newNode, tokens, i + 1);
                i = newIndex;
            } else {
                node.args.add(tokens[i]);
            }
            i++;
        }
        return i;

    }

    // private static int getCommandType(String token) {
    // if(token.equals("sq") || token.equals("li") || token.equals("lo")
    // || token.equals("ma") || token.equals("gr")) {
    //
    // return COMMAND_ALGORITHM;
    // } else if(token.equals("ran") || token.equals("pik")
    // || token.equals("pa") || token.equals("co")) {
    // return COMMAND_FUNCTION;
    // }
    // return -1;
    // }

    private static String spaceLine(String line) {
        StringBuffer buffer = new StringBuffer();

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '{' || c == '}') {
                buffer.append(" ").append(c).append(" ");
            } else {
                buffer.append(c);
            }
        }
        return buffer.toString();
    }

    private static int getPField(String line) {
        StringBuffer pfieldText = new StringBuffer();
        int index = line.indexOf("p") + 1;

        while (line.charAt(index) == ' ' || line.charAt(index) == '\t') {
            index++;
        }

        while (line.charAt(index) != ' ' && line.charAt(index) != '\t'
                && line.charAt(index) != '\n') {
            pfieldText.append(line.charAt(index));
            index++;
        }

        return Integer.parseInt(pfieldText.toString());
    }

    // private static String stripPfield(String line) {
    // return line.substring(line.indexOf("{"));
    // }

    public static void main(String[] args) {

        // String testData = "f1 0 8192 10 1\n"
        // + "instr 1 2 3\n"
        // + "p2 {sq {sq {ran f 0.1 0.15} 40} 1 [total_time]s};\n"
        // + "p3 {sq {lo .5 2 40} 1 [total_time]s} ;\n"
        // + "p4 {sq {ma f {ran i 4 5} {ran i 4 6} 10 10 40} [total_time]s};\n"
        // + "p5 {ma f 0.3 1 3 .2 [total_time]s};\n"
        // + "p6 {ma f 1 2 4 6 [total_time]s};\n"
        // + "p7 {sq {ran f 1 4} [total_time]s};\n" + "e";

        if (args.length != 1) {
            System.err.println("No file given");
            System.exit(1);
        }

//        ModuleDefinition mod = CeciliaModuleImportDialog
//                .convertCeciliaModule(new File(args[0]));
//
//        String testData = mod.score;
//        testData = TextUtilities.replaceAll(testData, "[total_time]", "30");
//        System.out.println(CybilCompiler.compile(testData, null));

        // ran test1 = new ran();
        // test1.args.add("i");
        // test1.args.add("80");
        // test1.args.add("170");
        //
        // System.out.println("[ran] 1. " + test1.getValue(null)[0]);
        // System.out.println("[ran] 2. " + test1.getValue(null)[0]);
        // System.out.println("[ran] 3. " + test1.getValue(null)[0]);
        //
        // pik test2 = new pik();
        // test2.args.add("1.2");
        // test2.args.add("9");
        // test2.args.add("100");
        // test2.args.add("2000");
        // test2.args.add("4.4");
        // test2.args.add("-6.4");
        // test2.args.add("51.967876");
        // test2.args.add(test1);
        //
        // System.out.println("[pik] 1. " + test2.getValue(null)[0]);
        // System.out.println("[pik] 2. " + test2.getValue(null)[0]);
        // System.out.println("[pik] 3. " + test2.getValue(null)[0]);
        //
        // System.out.println(CybilArg.getTimeValue("30s"));
        // System.out.println(CybilArg.getTimeValue("30"));
        // System.out.println(CybilArg.isTime("30s"));
        // System.out.println(CybilArg.isTime("30"));
        //
        // ma test3 = new ma();
        // test3.args.add("f");
        // test3.args.add("80");
        // test3.args.add("100");
        // test3.args.add("800");
        // test3.args.add("8000");
        // test3.args.add("30");
        //
        // CybilNoteList cybNotes = new CybilNoteList();
        // cybNotes.pfield = 4;
        //
        // for(int i = 0; i < 30; i++) {
        // cybNotes.notes.addNote(Note.createNote("i1 0 0 0 0 0 0 0 0 0 0"));
        // }
        //
        // test3.getValue(cybNotes);
        //
        // System.out.println("[ma] 1. \n" + cybNotes.notes.toString());
        //
        // ma test4 = new ma();
        // test4.args.add("i");
        // test4.args.add("80");
        // test4.args.add("100");
        // test4.args.add("800");
        // test4.args.add("8000");
        // test4.args.add("15s");
        //
        // cybNotes = new CybilNoteList();
        // cybNotes.pfield = 4;
        //
        // for(int i = 0; i < 30; i++) {
        // cybNotes.notes.addNote(Note.createNote("i1 " + i
        // + " 0 0 0 0 0 0 0 0 0"));
        // }
        //
        // test4.getValue(cybNotes);
        // System.out.println("[ma] 2. \n" + cybNotes.notes.toString());
        //
        // sq test5 = new sq();
        // test5.args.add("1");
        // test5.args.add("2");
        // test5.args.add("20s");
        //
        // cybNotes = new CybilNoteList();
        // cybNotes.pfield = 4;
        //
        // for(int i = 0; i < 30; i++) {
        // cybNotes.notes.addNote(Note.createNote("i1 " + i
        // + " 0 0 0 0 0 0 0 0 0"));
        // }
        //
        // test5.getValue(cybNotes);
        // System.out.println("[sq] 1. \n" + cybNotes.notes.toString());
        //
        // sq test6 = new sq();
        // test6.args.add("10");
        // test6.args.add("20");
        // test6.args.add(test5);
        // test6.args.add("300s");
        //
        // cybNotes = new CybilNoteList();
        // cybNotes.pfield = 2;
        //
        // test6.getValue(cybNotes);
        // System.out.println("[sq] 2. \n" + cybNotes.notes.toString());
        //
        // li test7 = new li();
        // test7.args.add("10");
        // test7.args.add("100");
        // test7.args.add("15");
        //
        // cybNotes = new CybilNoteList();
        // cybNotes.pfield = 4;
        //
        // for(int i = 0; i < 30; i++) {
        // cybNotes.notes.addNote(Note.createNote("i1 " + i
        // + " 0 0 0 0 0 0 0 0 0"));
        // }
        //
        // test7.getValue(cybNotes);
        // System.out.println("[li] \n" + cybNotes.notes.toString());
        //
        // lo test8 = new lo();
        // test8.args.add("10");
        // test8.args.add("1000");
        // test8.args.add("15");
        //
        // cybNotes = new CybilNoteList();
        // cybNotes.pfield = 4;
        //
        // for(int i = 0; i < 30; i++) {
        // cybNotes.notes.addNote(Note.createNote("i1 " + i
        // + " 0 0 0 0 0 0 0 0 0"));
        // }
        //
        // test8.getValue(cybNotes);
        // System.out.println("[lo] \n" + cybNotes.notes.toString());

    }

}