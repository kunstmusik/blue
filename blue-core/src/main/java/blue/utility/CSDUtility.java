package blue.utility;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
import blue.Arrangement;
import blue.BlueData;
import blue.BlueSystem;
import blue.SoundLayer;
import blue.orchestra.GenericInstrument;
import blue.soundObject.*;
import blue.time.TempoPoint;
import blue.time.TimeContext;
import blue.time.TimePosition;
import blue.udo.OpcodeList;
import blue.udo.UserDefinedOpcode;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.*;
import java.util.Map.Entry;

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

        if (orc != null) {
            parseCsOrc(data, orc);
        }
        if (sco != null) {
            parseCsScore(data, sco, importMode);
        }

        if (data.getScore().get(0).isEmpty()) {
            PolyObject pObj = (PolyObject) data.getScore().get(0);
            pObj.add(new SoundLayer());
        }

        return data;
    }

    protected static void parseCsScore(BlueData data, String scoreText, int importMode) {
        StringBuilder tables = new StringBuilder();
        StringBuilder iStatements = new StringBuilder();

        String[] lines = scoreText.split("\n");
        String line;

        for (int i = 0; i < lines.length; i++) {
            line = lines[i].trim();

            if (line.startsWith("f")) {
                tables.append(lines[i]).append("\n");

                if (i < lines.length - 1) {
                    do {
                        String nextLine = lines[i + 1].trim();

                        if (nextLine.length() == 0) {
                            break;
                        }

                        char c = nextLine.charAt(0);
                        if (Character.isDigit(c) || c == '\"' || c == '.') {
                            tables.append(lines[i + 1]).append("\n");
                            i++;
                        } else {
                            break;
                        }
                    } while (i < lines.length - 1);
                }

            } else if (line.startsWith("i")) {
                iStatements.append(line).append("\n");

                if (i < lines.length - 1) {
                    do {
                        String nextLine = lines[i + 1].trim();

                        if (nextLine.length() == 0) {
                            break;
                        }

                        char c = nextLine.charAt(0);
                        if (Character.isDigit(c) || c == '\"' || c == '.') {
                            iStatements.append(lines[i + 1]).append("\n");
                            i++;
                        } else {
                            break;
                        }
                    } while (i < lines.length - 1);
                }
            } else if (line.startsWith("s")) {
                iStatements.append(line).append("\n");
            } else if (line.startsWith("t")) {
                if (line.length() > 1) {
                    line = line.substring(1).trim();
                    var tempoMap = data.getScore().getTempoMap();
                    var parts = line.split("\\s+");

                    if (parts.length % 2 == 0) {
                        try {
                            tempoMap.reset();
                            for (int j = 0; j < parts.length; j += 2) {
                                double beat = Double.parseDouble(parts[j]);
                                double tempo = Double.parseDouble(parts[j + 1]);
                                if (j == 0) {
                                    // First point - set it (reset already created one at beat 0)
                                    tempoMap.setTempoPoint(0, beat, tempo);
                                } else {
                                    tempoMap.addTempoPoint(new TempoPoint(beat, tempo));
                                }
                            }
                            tempoMap.setEnabled(true);
                        } catch (Exception e) {
                            throw new RuntimeException("Invalid tempo statement found");
                        }
                    } else {
                        throw new RuntimeException("Invalid tempo statement found");
                    }
                }

            }

        }

        String noteText = iStatements.toString();
        ScoreSection[] sections;

        switch (importMode) {
            case IMPORT_GLOBAL:
                data.getScore().get(0).newLayerAt(-1);
                data.getGlobalOrcSco().setGlobalSco(noteText);
                break;

            case IMPORT_SINGLE_SOUNDOBJECT:
                sections = getScoreSections(noteText);
                for (ScoreSection scoreSection : sections) {
                    setSoundObjectPerSection(data, scoreSection);
                }
                break;

            case IMPORT_SOUNDOBJECT_PER_INSTRUMENT:
                sections = getScoreSections(noteText);
                for (ScoreSection section : sections) {
                    setSoundObjectsPerInstrument(data, section);
                }

                break;

        }

        data.getTableSet().setTables(tables.toString());
    }

    private static ScoreSection[] getScoreSections(String scoreText) {
        ArrayList<ScoreSection> scoreSections = new ArrayList<>();
        StringTokenizer st = new StringTokenizer(scoreText, "\n");
        String line = "";

        StringBuffer currentSection = new StringBuffer();
        double sectionStartTime = 0.0f;

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
        TimeContext context = data.getScore().getTimeContext();
        GenericScore genScore = createSizedGenericScore(section.scoreText,
                BlueSystem.getString("csd.importedScore"), context);

        genScore.setStartTime(TimePosition.beats(section.sectionStartTime));

        PolyObject pObj = (PolyObject) data.getScore().get(0);

        SoundLayer sLayer = pObj.newLayerAt(-1);
        sLayer.add(genScore);

    }

    // TODO - Possible problems with score processing here if SCO uses carry's,
    // ramp's, etc.
    private static void setSoundObjectsPerInstrument(BlueData data,
            ScoreSection section) {
        TimeContext context = data.getScore().getTimeContext();
        TreeMap<Integer, StringBuffer> map = new TreeMap<>();

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

            iNum = Integer.parseInt(note.getPField(1));

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

        for (Entry<Integer, StringBuffer> entry : map.entrySet()) {
            iNum = entry.getKey();
            buffer = entry.getValue();

            if (buffer == null) {
                continue;
            }

            PolyObject pObj = (PolyObject) data.getScore().get(0);
            sLayer = pObj.newLayerAt(-1);

            String score = buffer.toString();
            NoteList notes;

            try {
                notes = ScoreUtilities.getNotes(score);
            } catch (NoteParseException e) {
                throw new RuntimeException(e);
            }

            notes.sort();
            double minStart = notes.get(0).getStartTime();

            ScoreUtilities.normalizeNoteList(notes);

            GenericScore genScore = createSizedGenericScore(notes.toString(),
                    "Instrument " + iNum.toString(), context);

            genScore.setStartTime(TimePosition.beats(minStart + section.sectionStartTime));

            sLayer.add(genScore);

        }
    }

    private static GenericScore createSizedGenericScore(String noteText,
            String name, TimeContext context) {

        GenericScore genScore = new GenericScore();
        genScore.setText(noteText);
        genScore.setSubjectiveDuration(genScore.getObjectiveDuration(context));
        genScore.setName(name);
        return genScore;
    }

    private static void parseCsOrc(BlueData data, String orc) {
        StringTokenizer st = new StringTokenizer(orc, "\n");

        String line = "";

        StringBuilder globalOrch = new StringBuilder();

        String sr = null;
        String kr = null;
        String ksmps = null;

        String instrIds = "";

        StringBuffer iBody = new StringBuffer();
        StringBuilder udoDeclaration = null;

        UserDefinedOpcode udo = null;
        GenericInstrument instr = null;

        Arrangement arrangement = data.getArrangement();
        OpcodeList opcodeList = data.getOpcodeList();

        int state = 0;

        boolean reprocessCurrentLine = false;

        while (reprocessCurrentLine || st.hasMoreTokens()) {
            if (!reprocessCurrentLine) {
                line = st.nextToken();
            } else {
                reprocessCurrentLine = false;
            }
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

                        state = 1;

                    } else if (trimLine.startsWith("opcode")) {
                        int index = line.indexOf(';');
                        if (index != -1) {
                            line = line.substring(0, index);
                        }
                        udo = UDOUtilities.parseUDODeclaration(line);

                        if (udo != null) {
                            state = 2;
                        } else {
                            udoDeclaration = new StringBuilder(line.trim());
                            state = 3;
                        }
                    } else {
                        if (trimLine.startsWith("kr")) {
                            kr = line.substring(line.indexOf('=') + 1).trim();
                        } else if (trimLine.startsWith("sr")) {
                            sr = line.substring(line.indexOf('=') + 1).trim();
                        } else if (trimLine.startsWith("nchnls")) {
                            data.getProjectProperties().channels = line
                                    .substring(line.indexOf('=') + 1).trim();
                        } else if (trimLine.startsWith("ksmps")) {
                            ksmps = line.substring(line.indexOf('=') + 1)
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

                            if (instrIds.indexOf(',') > -1) {
                                String[] ids = instrIds.split(",");

                                for (String id : ids) {
                                    arrangement.insertInstrument(id, instr);
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
                            UDOUtilities.finalizeParsedUDO(udo, iBody.toString());
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
                case 3:
                    if (UDOUtilities.isInstrOrUDODeclarationBoundary(trimLine)) {
                        udoDeclaration = null;
                        state = 0;
                        reprocessCurrentLine = true;
                        break;
                    }

                    if (!trimLine.isBlank()) {
                        udoDeclaration.append("\n").append(trimLine);
                    }

                    udo = UDOUtilities.parseUDODeclaration(udoDeclaration.toString());
                    if (udo != null) {
                        udoDeclaration = null;
                        state = 2;
                    }
                    break;
            }
        }

        /* HANDLE RESERVED GLOBAL VARIABLES */
        if (kr != null && ksmps == null) {
            try {
                double krDouble = Double.parseDouble(kr);
                double srDouble = Double.parseDouble(sr);
                ksmps = Integer.toString((int) (srDouble / krDouble));
            } catch (NumberFormatException nfe) {
                ksmps = null;
            }
        }

        if (sr != null) {
            data.getProjectProperties().setSampleRate(sr);
        }

        if (ksmps != null) {
            data.getProjectProperties().ksmps = ksmps;
        }

        data.getGlobalOrcSco().setGlobalOrc(globalOrch.toString());
    }

    public static void main(String[] args) {
        File test = new File("/work/blue/trappedInConvert/01-Trapped.csd");

        try (BufferedReader in = new BufferedReader(new FileReader(test))) {
            String line = "";
            StringBuilder buffer = new StringBuilder();
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

    double sectionStartTime = 0.0f;
}
