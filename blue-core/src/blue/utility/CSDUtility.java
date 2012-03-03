package blue.utility;

/**
 * Title:        blue
 * Description:  an object composition environment for csound
 * Copyright:    Copyright (c) 2001
 * Company:      steven yi music
 * @author steven yi
 * @version 1.0
 */

import blue.Arrangement;
import blue.BlueData;
import blue.BlueSystem;
import blue.SoundLayer;
import blue.orchestra.GenericInstrument;
import blue.soundObject.GenericScore;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.udo.OpcodeList;
import blue.udo.UserDefinedOpcode;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.Map.Entry;
import java.util.*;

public class CSDUtility {
    public static final int IMPORT_GLOBAL = 0;

    public static final int IMPORT_SINGLE_SOUNDOBJECT = 1;

    public static final int IMPORT_SOUNDOBJECT_PER_INSTRUMENT = 2;

    public CSDUtility() {
    }

    public static BlueData convertOrcScoToBlue(File orcFile, File scoFile,
            int importMode) {

        BlueData data = null;

        try {
            String orc = TextUtilities.getTextFromFile(orcFile);
            String sco = TextUtilities.getTextFromFile(scoFile);

            data = new BlueData();

            parseCsOrc(data, orc);
            parseCsScore(data, sco, importMode);
        } catch (Exception e) {
            e.printStackTrace();
        }

        return data;
    }

    public static BlueData convertCSDtoBlue(File csdFile, int importMode) {
        BlueData data = null;

        try {
            String CSD = TextUtilities.getTextFromFile(csdFile);
            data = convertCSDtoBlue(CSD, importMode);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return data;
    }

    private static BlueData convertCSDtoBlue(String CSD, int importMode) {
        BlueData data = new BlueData();

        // String csOptions = TextUtilities.getTextBetweenTags("CsOptions",
        // CSD);

        // if (csOptions != null && csOptions.trim().length() > 0) {
        // data.getProjectProperties().CsOptions = csOptions.trim();
        // }

        
        String orc = TextUtilities.getTextBetweenTags("CsInstruments", CSD);
        String sco = TextUtilities.getTextBetweenTags("CsScore", CSD);

        parseCsOrc(data, orc);
        parseCsScore(data, sco, importMode);

        return data;
    }

    protected static void parseCsScore(BlueData data, String scoreText, int importMode) {
        // String CsScore = getScore(CSD);

        StringBuffer tables = new StringBuffer();
        StringBuffer iStatements = new StringBuffer();

        String[] lines = scoreText.split("\n");
        String line;
       
        for(int i = 0; i < lines.length; i++) {
            line = lines[i].trim();

            if (line.startsWith("f")) {
                tables.append(lines[i]).append("\n");

                if(i < lines.length - 1) {
                    do {
                        String nextLine = lines[i + 1].trim();

                        if(nextLine.length() == 0) {
                            break;
                        }

                        char c = nextLine.charAt(0);
                        if(Character.isDigit(c) || c == '\"' || c == '.') {
                            tables.append(lines[i + 1]).append("\n");
                            i++;
                        } else {
                            break;
                        }
                    } while (i < lines.length - 1);
                }

            } else if (line.startsWith("i")) {
                iStatements.append(line).append("\n");
                
                if(i < lines.length - 1) {
                    do {
                        String nextLine = lines[i + 1].trim();

                        if(nextLine.length() == 0) {
                            break;
                        }

                        char c = nextLine.charAt(0);
                        if(Character.isDigit(c) || c == '\"' || c == '.') {
                            iStatements.append(lines[i + 1]).append("\n");
                            i++;
                        } else {
                            break;
                        }
                    } while (i < lines.length - 1);
                }
            } else if(line.startsWith("s")) {
                iStatements.append(line).append("\n");
            }

        }

        String noteText = iStatements.toString();
        ScoreSection[] sections;

        switch (importMode) {
            case IMPORT_GLOBAL:
                data.getGlobalOrcSco().setGlobalSco(noteText);
                break;

            case IMPORT_SINGLE_SOUNDOBJECT:
                sections = getScoreSections(noteText);
                for (int i = 0; i < sections.length; i++) {
                    setSoundObjectPerSection(data, sections[i]);
                }
                break;

            case IMPORT_SOUNDOBJECT_PER_INSTRUMENT:
                sections = getScoreSections(noteText);
                for (int i = 0; i < sections.length; i++) {
                    setSoundObjectsPerInstrument(data, sections[i]);
                }

                break;

        }

        data.getTableSet().setTables(tables.toString());
    }

    private static ScoreSection[] getScoreSections(String scoreText) {
        ArrayList scoreSections = new ArrayList();
        StringTokenizer st = new StringTokenizer(scoreText, "\n");
        String line = "";

        StringBuffer currentSection = new StringBuffer();
        float sectionStartTime = 0.0f;

        while (st.hasMoreTokens()) {
            line = st.nextToken().trim();

            if (line.startsWith("s")) {
                ScoreSection section = new ScoreSection();
                section.scoreText = currentSection.toString();
                section.sectionStartTime = sectionStartTime;

                scoreSections.add(section);

                NoteList nl;

                try {
                    nl = ScoreUtilities.getNotes(section.scoreText);
                } catch (NoteParseException e) {
                    throw new RuntimeException(e);
                }
                sectionStartTime += ScoreUtilities.getTotalDuration(nl);
                currentSection = new StringBuffer();

            } else {
                currentSection.append(line).append("\n");

            }
        }

        ScoreSection section = new ScoreSection();
        section.scoreText = currentSection.toString();
        section.sectionStartTime = sectionStartTime;

        scoreSections.add(section);

        ScoreSection[] returnSections = new ScoreSection[scoreSections.size()];

        for (int i = 0; i < scoreSections.size(); i++) {
            returnSections[i] = (ScoreSection) scoreSections.get(i);
        }

        return returnSections;
    }

    private static void setSoundObjectPerSection(BlueData data,
            ScoreSection section) {
        GenericScore genScore = createSizedGenericScore(section.scoreText,
                BlueSystem.getString("csd.importedScore"));

        genScore.setStartTime(section.sectionStartTime);

        SoundLayer sLayer = data.getPolyObject().newSoundLayer();
        sLayer.addSoundObject(genScore);

    }

    // TODO - Possible problems with score processing here if SCO uses carry's,
    // ramp's, etc.
    private static void setSoundObjectsPerInstrument(BlueData data,
            ScoreSection section) {
        TreeMap map = new TreeMap();

        StringTokenizer st = new StringTokenizer(section.scoreText, "\n");
        String line = "";

        Note previousNote = null;
        Note note;
        Integer iNum;
        StringBuffer buffer;

        while (st.hasMoreTokens()) {
            line = st.nextToken();

            note = null;

            try {
                note = Note.createNote(line, previousNote);
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }

            if (note == null) {
                continue;
            }

            iNum = new Integer(Integer.parseInt(note.getPField(1)));

            if (map.containsKey(iNum)) {
                buffer = (StringBuffer) map.get(iNum);
                buffer.append(line).append("\n");
            } else {
                buffer = new StringBuffer();
                buffer.append(line).append("\n");
                map.put(iNum, buffer);
            }
            previousNote = note;
        }

        SoundLayer sLayer;

        for (Iterator iter = map.entrySet().iterator(); iter.hasNext();) {
            Map.Entry entry = (Entry) iter.next();

            iNum = (Integer) entry.getKey();
            buffer = (StringBuffer) entry.getValue();

            if (buffer == null) {
                continue;
            }

            sLayer = data.getPolyObject().newSoundLayer();

            String score = buffer.toString();
            NoteList notes;

            try {
                notes = ScoreUtilities.getNotes(score);
            } catch (NoteParseException e) {
                throw new RuntimeException(e);
            }

            notes.sort();
            float minStart = notes.getNote(0).getStartTime();

            ScoreUtilities.normalizeNoteList(notes);

            GenericScore genScore = createSizedGenericScore(notes.toString(),
                    "Instrument " + iNum.toString());

            genScore.setStartTime(minStart + section.sectionStartTime);

            sLayer.addSoundObject(genScore);

        }
    }

    private static GenericScore createSizedGenericScore(String noteText,
            String name) {

        GenericScore genScore = new GenericScore();
        genScore.setText(noteText);
        genScore.setSubjectiveDuration(genScore.getObjectiveDuration());
        genScore.setName(name);
        return genScore;
    }

    private static void parseCsOrc(BlueData data, String orc) {
        StringTokenizer st = new StringTokenizer(orc, "\n");

        String line = "";

        StringBuffer globalOrch = new StringBuffer();

        String sr = null;
        String kr = null;
        String ksmps = null;

        String instrIds = "";

        StringBuffer iBody = new StringBuffer();

        UserDefinedOpcode udo = null;
        GenericInstrument instr = null;

        Arrangement arrangement = data.getArrangement();
        OpcodeList opcodeList = data.getOpcodeList();

        int state = 0;

        while (st.hasMoreTokens()) {
            line = st.nextToken();
            String trimLine = line.trim();

            switch (state) {
                case 0:
                    if (trimLine.startsWith("instr")) {
                        int index = line.indexOf(';');
                        String iName = "";

                        if (index != -1) {
                            iName = line.substring(index + 1).trim();
                            line = line.substring(0, index);
                        }
                        instrIds = line.substring(line.indexOf("instr") + 5)
                                .trim();

                        instr = new GenericInstrument();
                        instr.setName(iName);
                        instr.setEnabled(true);

                        state = 1;

                    } else if (trimLine.startsWith("opcode")) {
                        int index = line.indexOf(';');
                        if (index != -1) {
                            line = line.substring(0, index);
                        }
                        line = line.substring(line.indexOf("opcode") + 6)
                                .trim();

                        String parts[] = line.split(",");

                        if (parts.length != 3) {
                            System.err.println("Error parsing UDO: 3 args "
                                    + "not found for definition");
                        } else {
                            udo = new UserDefinedOpcode();
                            udo.setOpcodeName(parts[0].trim());
                            udo.outTypes = parts[1].trim();
                            udo.inTypes = parts[2].trim();
                        }

                        state = 2;
                    } else {
                        if (trimLine.startsWith("kr")) {
                            kr = line.substring(line.indexOf("=") + 1).trim();
                        } else if (trimLine.startsWith("sr")) {
                            sr = line.substring(line.indexOf("=") + 1).trim();
                        } else if (trimLine.startsWith("nchnls")) {
                            data.getProjectProperties().channels = line
                                    .substring(line.indexOf("=") + 1).trim();
                        } else if (trimLine.startsWith("ksmps")) {
                            ksmps = line.substring(line.indexOf("=") + 1)
                                    .trim();
                        } else {
                            globalOrch.append(line).append("\n");
                        }
                    }
                    break;
                case 1:
                    if (trimLine.startsWith("endin")) {

                        if (instr != null && instrIds != null) {
                            instr.setText(iBody.toString());

                            if (instrIds.indexOf(",") > -1) {
                                String ids[] = instrIds.split(",");

                                for (int i = 0; i < ids.length; i++) {
                                    arrangement.insertInstrument(ids[i], instr);
                                }

                            } else {
                                arrangement.insertInstrument(instrIds, instr);
                            }

                        }

                        instr = null;
                        instrIds = null;
                        iBody = new StringBuffer();

                        state = 0;
                    } else {
                        if (instr != null) {
                            iBody.append(line).append("\n");
                        }
                    }
                    break;
                case 2:
                    if (trimLine.startsWith("endop")) {
                        if (udo != null) {
                            udo.codeBody = iBody.toString();
                            opcodeList.addOpcode(udo);
                            iBody = new StringBuffer();

                            udo = null;
                        }
                        state = 0;
                    } else {
                        if (udo != null) {
                            iBody.append(line).append("\n");
                        }
                    }
                    break;
            }
        }

        /* HANDLE RESERVED GLOBAL VARIABLES */

        if (kr != null && ksmps == null) {
            try {
                float krFloat = Float.parseFloat(kr);
                float srFloat = Float.parseFloat(sr);
                ksmps = Integer.toString((int) (srFloat / krFloat));
            } catch (NumberFormatException nfe) {
                ksmps = null;
            }
        }

        if (sr != null) {
            data.getProjectProperties().sampleRate = sr;
        }

        if (ksmps != null) {
            data.getProjectProperties().ksmps = ksmps;
        }

        data.getGlobalOrcSco().setGlobalOrc(globalOrch.toString());
    }

    public static void main(String args[]) {
        File test = new File("/work/blue/trappedInConvert/01-Trapped.csd");

        try {
            BufferedReader in = new BufferedReader(new FileReader(test));
            String line = "";
            StringBuffer buffer = new StringBuffer();
            while ((line = in.readLine()) != null) {
                buffer.append(line).append("\n");
            }
            String CSD = buffer.toString();

            BlueData data = CSDUtility.convertCSDtoBlue(CSD,
                    CSDUtility.IMPORT_SINGLE_SOUNDOBJECT);

            System.out.println(data.saveAsXML());

        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }
}
class ScoreSection {
    String scoreText = "";

    float sectionStartTime = 0.0f;
}