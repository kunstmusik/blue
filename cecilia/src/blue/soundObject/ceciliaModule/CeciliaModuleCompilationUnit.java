/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.soundObject.ceciliaModule;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.StringTokenizer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

import blue.Arrangement;
import blue.BlueSystem;
import blue.GlobalOrcSco;
import blue.Tables;
import blue.orchestra.GenericInstrument;
import blue.orchestra.Instrument;
import blue.soundObject.CeciliaModule;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.SoundObject;
import blue.soundObject.ceciliaModule.cybil.CybilCompiler;
import blue.utility.ScoreUtilities;
import blue.utility.TextUtilities;

public class CeciliaModuleCompilationUnit {

    private static long uniqueIDCount = 0;

    private long uniqueID;

    String globalOrc = "";

    HashMap instruments = new LinkedHashMap();

    HashMap instrIDMap = new HashMap();

    Instrument magicInstrument = null;

    HashMap ftables = new HashMap();

    HashMap ftableNumMap = new HashMap();

    HashMap ceciliaVariables = new HashMap();

    ArrayList magicInstrument_instr = new ArrayList();

    ArrayList magicInstrument_tables = new ArrayList();

    ArrayList magicInstrument_gen_nums = new ArrayList();

    int magicInstrId = Integer.MIN_VALUE;

    NoteList notes = new NoteList();

    private static Pattern sinfoPattern = null;

    private CeciliaModule cm;

    static {
        try {

            // PatternCompiler compiler = new Perl5Compiler();
            // globalUniquePattern = Pattern.compile("(g[ika]\\w*)");
            sinfoPattern = Pattern.compile("\\[sinfo\\s+(\\w+)\\s+(\\w+)\\]");
        } catch (PatternSyntaxException e) {
            e.printStackTrace();
        }
    }

    private static long generateUniqueID() {
        return uniqueIDCount++;
    }

    public CeciliaModuleCompilationUnit(CeciliaModule cm) {
        this.cm = cm;

        this.uniqueID = CeciliaModuleCompilationUnit.generateUniqueID();
        String orch = getOrchestraByVersion(cm);

        parseStateData(cm);

        parseOrchestra(orch);
    }

    /**
     * @param cm
     */
    private void parseStateData(CeciliaModule cm) {
        HashMap stateData = cm.getStateData();
        // StringBuffer magicInstrumentText = new StringBuffer();

        StringBuffer orcBuffer = new StringBuffer();

        for (Iterator iter = stateData.values().iterator(); iter.hasNext();) {
            CeciliaObject stateObj = (CeciliaObject) iter.next();

            if (stateObj instanceof CToggle) {
                orcBuffer.append(((CToggle) stateObj).generateToggleText());
            } else if (stateObj instanceof CGraph) {
                CGraph graph = (CGraph) stateObj;
                String optext = "gk" + graph.getObjectName() + "_"
                        + this.uniqueID + " oscil1i 0, 1, p3, f#";
                String ftext = createMagicInstrumentTable(graph, Integer
                        .parseInt(cm.getGenSize()));

                magicInstrument_instr.add(optext);
                magicInstrument_tables.add(ftext);
                magicInstrument_gen_nums.add(Integer.toString(graph.getGen()));

                String initText = "gk" + graph.getObjectName();
                initText += " init ";

                CGraphPoint point = (CGraphPoint) graph.getPoints().get(0);

                float max = graph.getMax();
                float min = graph.getMax();
                float range = max - min;
                float val = (point.value * range) + min;

                initText += val + "\n";

                orcBuffer.append(initText);
            } else if (stateObj instanceof CSlider) {
                CSlider slider = (CSlider) stateObj;
                orcBuffer.append(slider.generateSliderText());
                ceciliaVariables.put(slider.getObjectName(), slider
                        .getValueAsString());
            } else if (stateObj instanceof CFileIn) {
                CFileIn cfileIn = (CFileIn) stateObj;
                ceciliaVariables.put(cfileIn.getObjectName(), cfileIn
                        .getFileName());
                if (cfileIn.isAudioFile()) {
                    float val = cfileIn.getOffset() / 10.0f;

                    ceciliaVariables.put("off" + cfileIn.getObjectName(), Float
                            .toString(val));
                }

            }

        }

        String totalTime = Float.toString(cm.getSubjectiveDuration());

        ceciliaVariables.put("total_time", totalTime);
        ceciliaVariables.put("duree_totale", totalTime);

        globalOrc += orcBuffer.toString();
        // System.err.println(magicInstrumentText);

    }

    /**
     * @param graph
     * @param string
     * @return
     */
    private String createMagicInstrumentTable(CGraph graph, int genSize) {
        ArrayList points = graph.getPoints();

        float range = graph.getMax() - graph.getMin();
        float min = graph.getMin();

        StringBuffer tableString = new StringBuffer();
        boolean firstPoint = true;

        float runningTime = 0.0f;

        for (Iterator iter = points.iterator(); iter.hasNext();) {
            CGraphPoint point = (CGraphPoint) iter.next();

            if (firstPoint) {
                float value = (point.value * range) + min;
                tableString.append(value);
                firstPoint = false;
            } else {
                float time = (point.time * genSize);
                float value = (point.value * range) + min;

                tableString.append(" ").append(time - runningTime).append(" ")
                        .append(value);

                runningTime = time;
            }
        }

        tableString.append(" ;");
        tableString.append(graph.getLabel());

        return tableString.toString();
    }

    /**
     * @param globalOrcSco
     */
    public void generateGlobals(GlobalOrcSco globalOrcSco) {
        StringBuffer buffer = new StringBuffer();
        buffer.append(this.globalOrc);

        for (Iterator iter = magicInstrument_instr.iterator(); iter.hasNext();) {
            String line = (String) iter.next();
            buffer.append(line).append("\n");
        }

        globalOrcSco.appendGlobalOrc(setGlobalUnique(this.globalOrc));
    }

    /**
     * @param string
     * @return
     */
    private String setGlobalUnique(String string) {
        String output = string
                .replaceAll("(g[ika]\\w*)", "$1_" + this.uniqueID);

        return output;
    }

    /**
     * @param text
     * @return
     */
    private String setFtableUnique(String text) {
        String retVal = text;

        ArrayList keyset = new ArrayList(ftableNumMap.keySet());

        Collections.sort(keyset, new Comparator() {

            public int compare(Object o1, Object o2) {
                return Integer.parseInt((String) o1)
                        - Integer.parseInt((String) o2);
            }
        });

        // use reverse iteration so that ftable4 won't replace ftable44
        for (int i = keyset.size() - 1; i >= 0; i--) {
            String oldNum = (String) keyset.get(i);
            String newNum = (String) ftableNumMap.get(oldNum);

            // System.err.println("ftable" + oldNum + " : " + newNum);

            retVal = TextUtilities
                    .replaceAll(retVal, "ftable" + oldNum, newNum);

        }

        // clean up any extra ftable statements
        // retVal = TextUtilities.replaceAll(text, "ftable", "");

        return retVal;
    }

    /**
     * @param tables
     */
    public void generateFTables(CeciliaModule cm, Tables tables) {
        StringBuffer newTableText = new StringBuffer();

        for (Iterator iter = ftables.keySet().iterator(); iter.hasNext();) {
            String oldNum = (String) iter.next();
            String tableText = (String) ftables.get(oldNum);

            int newNum = tables.getOpenFTableNumber();

            newTableText.append("f");
            newTableText.append(Integer.toString(newNum));
            newTableText.append("\t");
            newTableText.append(tableText);
            newTableText.append("\n");

            ftableNumMap.put(oldNum, Integer.toString(newNum));
        }

        for (int i = 0; i < magicInstrument_tables.size(); i++) {
            String tableText = (String) magicInstrument_tables.get(i);
            String instrTextLine = (String) magicInstrument_instr.get(i);

            int newNum = tables.getOpenFTableNumber();
            String newNumText = Integer.toString(newNum);

            newTableText.append("f");
            newTableText.append(newNumText);
            newTableText.append(" 0 ");
            newTableText.append(cm.getGenSize());
            newTableText.append(" -7 ");
            newTableText.append("\t");
            newTableText.append(tableText);
            newTableText.append("\n");

            instrTextLine = TextUtilities.replace(instrTextLine, "f#",
                    newNumText);
            magicInstrument_instr.set(i, instrTextLine);

            String genNum = (String) magicInstrument_gen_nums.get(i);
            if (!genNum.equals("-1")) {
                ftableNumMap.put(genNum, newNumText);
            }

        }

        tables.setTables(tables.getTables() + "\n" + newTableText.toString());
    }

    /**
     * @param arrangement
     */
    public void generateInstruments(Arrangement arrangement) {
        Instrument magicInstrument = getMagicInstrument();

        if (magicInstrument != null) {
            magicInstrId = arrangement.addInstrument(magicInstrument);
        }

        for (Iterator iter = instruments.keySet().iterator(); iter.hasNext();) {
            String key = (String) iter.next();
            GenericInstrument instr = (GenericInstrument) instruments.get(key);

            instr.setText(setGlobalUnique(instr.getText()));
            instr.setText(setFtableUnique(instr.getText()));
            instr.setText(replaceCeciliaVariables(instr.getText()));

            int newNum = arrangement.addInstrument(instr);
            String newId = Integer.toString(newNum);

            // System.out.println("Key/ID: " + key + " : " + newId);

            instrIDMap.put(key.trim(), newId);

        }

    }

    /**
     * @param text
     * @return
     */
    private String replaceCeciliaVariables(String text) {
        String retVal = text;

        appendSinfoVariables(retVal);

        for (Iterator iter = ceciliaVariables.keySet().iterator(); iter
                .hasNext();) {
            String key = (String) iter.next();
            String val = (String) ceciliaVariables.get(key);
            retVal = TextUtilities.replaceAll(retVal, "[" + key + "]", val);
            retVal = TextUtilities.replaceAll(retVal, "$value(" + key + ")",
                    val);
        }

        return retVal;
    }

    /**
     * @param retVal
     */
    private void appendSinfoVariables(String retVal) {
        // PatternMatcher matcher = new Perl5Matcher();
        //
        // PatternMatcherInput input = new PatternMatcherInput(retVal);

        Matcher matcher = sinfoPattern.matcher(retVal);

        if (sinfoPattern != null) {
            while (matcher.find()) {
                // while (matcher.contains(input, sinfoPattern)) {

                // MatchResult match = matcher.getMatch();

                // System.err.println(match.group(1) + " : " + match.group(2));

                // String key = match.toString();
                String key = matcher.group();

                String result = key.substring(1, key.length() - 1);

                String objectName = matcher.group(1);
                String prop = matcher.group(2);

                CFileIn cfilein;

                try {
                    cfilein = (CFileIn) cm.getStateData().get(objectName);
                } catch (Exception e) {
                    e.printStackTrace();
                    break;
                }

                String val = null;

                if (prop.equals("sr")) {
                    val = Float.toString(cfilein.getSampleRate());
                } else if (prop.equals("frames")) {
                    val = Integer.toString(cfilein.getFrames());
                } else if (prop.equals("dur")) {
                    val = Float.toString(cfilein.getDuration());
                } else if (prop.equals("chn")) {
                    val = Integer.toString(cfilein.getChannels());
                } else {
                    String errMessage = "["
                            + BlueSystem.getString("message.error")
                            + "] - "
                            + BlueSystem
                                    .getString("ceciliaModule.propNotFound")
                            + " ";

                    System.err.println(errMessage + prop);
                    break;
                }

                if (val == null) {
                    String errMessage = "["
                            + BlueSystem.getString("message.error")
                            + "] - "
                            + BlueSystem
                                    .getString("ceciliaModule.valueNotFound")
                            + " ";

                    System.err.println(errMessage + prop);
                    break;
                }

                // System.err.println(key + " : " + val);
                ceciliaVariables.put(result, val);

            }
        }
    }

    /**
     * @return
     */
    private Instrument getMagicInstrument() {
        if (magicInstrument_instr.size() == 0) {
            return null;
        }

        GenericInstrument instr = new GenericInstrument();
        StringBuffer instrText = new StringBuffer();

        for (Iterator iter = magicInstrument_instr.iterator(); iter.hasNext();) {
            String line = (String) iter.next();
            instrText.append(line).append("\n");
        }
        instr.setText(instrText.toString());
        instr.setName("CeciliaModule Magic Instrument");
        return instr;
    }

    /**
     * @return
     * @throws NoteParseException
     */
    public NoteList generateNotes(CeciliaModule cm) throws NoteParseException {
        parseScore(cm, cm.getModuleDefinition().score.trim());

        NoteList nl = new NoteList();

        if (magicInstrId != Integer.MIN_VALUE) {
            String magicNote = "i" + Integer.toString(magicInstrId) + " 0 "
                    + cm.getSubjectiveDuration();

            nl.addNote(Note.createNote(magicNote));

        }

        for (Iterator iter = notes.iterator(); iter.hasNext();) {
            Note note = (Note) iter.next();
            String id = note.getPField(1).trim();

            String newId = (String) instrIDMap.get(id);
            note.setPField(newId, 1);
            nl.addNote(note);
        }

        ScoreUtilities.applyTimeBehavior(nl, SoundObject.TIME_BEHAVIOR_SCALE,
                cm.getSubjectiveDuration(), cm.getRepeatPoint());

        ScoreUtilities.setScoreStart(nl, cm.getStartTime());

        return nl;
    }

    private void parseScore(CeciliaModule cm, String scoreText)
            throws NoteParseException {
        // Needs to grab ftables, reassign them, store in table
        // take score, reassign values from cm's stateData

        if (scoreText.startsWith("#min")) {
            String noteLine = "i1 0 "
                    + Float.toString(cm.getSubjectiveDuration());

            notes.addNote(Note.createNote(noteLine));
        } else if (scoreText.startsWith("#cyb")) {
            scoreText = replaceCeciliaVariables(scoreText);
            /*
             * JOptionPane.showMessageDialog(null, "Cybil scores are partially
             * supported.");
             */
            scoreText = CybilCompiler.compile(scoreText, cm);
            // System.out.println(scoreText);
            parseFlatScore(scoreText);
        } else if (scoreText.startsWith("#tcl")) {
            scoreText = replaceCeciliaVariables(scoreText);
            System.out.println(scoreText);
            scoreText = TCLScoreCompiler.compile(scoreText);
            parseFlatScore(scoreText);
        } else {

            parseFlatScore(scoreText);
        }
    }

    /**
     * @param scoreText
     * @throws NoteParseException
     */
    private void parseFlatScore(String scoreText) throws NoteParseException {
        StringTokenizer st = new StringTokenizer(scoreText, "\n");

        while (st.hasMoreTokens()) {
            String line = st.nextToken().trim();

            if (line.startsWith("i")) {
                line = replaceCeciliaVariables(line);

                notes.addNote(Note.createNote(line));
            } else if (line.startsWith("f")) {
                line = line.substring(1).trim();

                String tableNum = getFTableNum(line);
                String strippedTable = line.substring(tableNum.length());

                ftables.put(tableNum, strippedTable);

            } else {
                System.err.println(BlueSystem
                        .getString("ceciliaModule.lineNotUsed")
                        + " " + line);
            }
        }
    }

    private String getFTableNum(String line) {

        int index = 0;
        String tableNum = "";

        while (line.charAt(index) != ' ' && line.charAt(index) != '\t'
                && line.charAt(index) != '\n') {
            tableNum += line.charAt(index);
            index++;
        }

        return tableNum;
    }

    private void parseOrchestra(String orch) {
        StringTokenizer st = new StringTokenizer(orch, "\n");

        StringBuffer globalBuffer = new StringBuffer();
        StringBuffer instrBuffer = new StringBuffer();
        String instrID = "";

        int mode = 0;

        while (st.hasMoreTokens()) {
            String line = st.nextToken().trim();

            switch (mode) {
                case 0:
                    if (line.startsWith("instr")) {
                        int index = line.indexOf(';');
                        if (index != -1) {
                            line = line.substring(0, index);
                        }

                        line = line.substring(line.indexOf("instr") + 5);
                        instrID = line.trim();

                        mode = 1;
                    } else if (line.startsWith("kr") || line.startsWith("sr")
                            || line.startsWith("ksmps")
                            || line.startsWith("nchnls")) {

                        // ignore
                    } else {
                        globalBuffer.append(line).append("\n");
                    }
                    break;

                case 1:
                    if (line.startsWith("endin")) {
                        GenericInstrument instr = new GenericInstrument();
                        instr.setText(instrBuffer.toString());

                        if (instrID.indexOf(",") > 0) {
                            StringTokenizer idTokenizer = new StringTokenizer(
                                    instrID, ",");

                            while (idTokenizer.hasMoreElements()) {
                                String id = idTokenizer.nextToken();
                                instruments.put(id, instr.clone());
                            }

                        } else {
                            instruments.put(instrID, instr);
                        }

                        instrID = "";
                        instrBuffer = new StringBuffer();
                        mode = 0;

                    } else {
                        instrBuffer.append(line).append("\n");
                    }

                    break;

            }

        }

        globalOrc += globalBuffer.toString();

    }

    private String getOrchestraByVersion(CeciliaModule cm) {
        String orch = "";

        switch (cm.getOrchestraVersion()) {
            case CeciliaModule.ORCHESTRA_MONO:
                orch = cm.getModuleDefinition().mono;
                break;
            case CeciliaModule.ORCHESTRA_STEREO:
                orch = cm.getModuleDefinition().stereo;
                break;
            case CeciliaModule.ORCHESTRA_QUAD:
                orch = cm.getModuleDefinition().quad;
                break;
        }
        return orch;
    }

}