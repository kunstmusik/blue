package blue.ui.core.render;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
import blue.Arrangement;
import blue.BlueConstants;
import blue.BlueData;
import blue.CompileData;
import blue.GlobalOrcSco;
import blue.InstrumentAssignment;
import blue.ProjectProperties;
import blue.Tables;
import blue.automation.Automatable;
import blue.automation.Parameter;
import blue.components.lines.Line;
import blue.components.lines.LinePoint;
import blue.mixer.ChannelList;
import blue.mixer.Mixer;
import blue.noteProcessor.TempoMapper;
import blue.orchestra.GenericInstrument;
import blue.orchestra.Instrument;
import blue.orchestra.blueSynthBuilder.StringChannel;
import blue.orchestra.blueSynthBuilder.StringChannelNameManager;
import blue.score.ScoreGenerationException;
import blue.score.tempo.Tempo;
import blue.services.render.CSDRenderService;
import blue.services.render.CsdRenderResult;
import blue.settings.PlaybackSettings;
import blue.soundObject.GenericScore;
import blue.soundObject.Note;
import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import blue.soundObject.SoundObjectException;
import blue.udo.OpcodeList;
import blue.utility.NumberUtilities;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreUtilities;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.StringTokenizer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.text.StrBuilder;
import org.openide.util.lookup.ServiceProvider;

@ServiceProvider(service = CSDRenderService.class)
public class CSDRender extends CSDRenderService {

    private final MessageFormat PARAM_VAR_NAME = new MessageFormat(
            "gk_blue_auto{0}");

    @Override
    protected synchronized CsdRenderResult generateCSDForBlueLiveImpl(
            BlueData data, boolean usingAPI) {

        ArrayList<StringChannel> stringChannels = getStringChannels(data.getArrangement());

        ParameterHelper.clearCompilationVarNames(data);

        float totalDur = 36000f;

        // making copies to use for adding compileTime tables and instruments
        Tables tables = (Tables) data.getTableSet().clone();

        ArrayList<Parameter> originalParameters = null;

        if (usingAPI) {
            originalParameters = ParameterHelper.getAllParameters(
                    data.getArrangement(), data.getMixer());
            assignParameterNames(originalParameters);
        }


        Arrangement arrangement = (Arrangement) data.getArrangement().clone();
        arrangement.clearUnusedInstrAssignments();

        String[] instrIds = arrangement.getInstrumentIds();

        //PolyObject tempPObj = (PolyObject) data.getPolyObject().clone();

        boolean hasInstruments = arrangement.size() > 0;

        GlobalOrcSco globalOrcSco = (GlobalOrcSco) data.getGlobalOrcSco().clone();

        OpcodeList udos = (OpcodeList) ObjectUtilities.clone(
                data.getOpcodeList());

        // add all UDO's from instruments and effects
        arrangement.generateUserDefinedOpcodes(udos);
        appendFtgenTableNumbers(globalOrcSco.getGlobalOrc(), tables);
        arrangement.generateFTables(tables);
        
        // SKIPPING ANYTHING RELATED TO SCORE

        String globalSco = globalOrcSco.getGlobalSco() + "\n";
        globalSco += arrangement.generateGlobalSco() + "\n";
        globalSco = preprocessSco(globalSco, totalDur, 0, 0, null);

        boolean mixerEnabled = data.getMixer().isEnabled();
        Mixer mixer = null;
        if (mixerEnabled) {
            mixer = (Mixer) data.getMixer().clone();
        }

        int nchnls = getNchnls(data, true);

        ArrayList<Instrument> alwaysOnInstruments = new ArrayList<Instrument>();

        arrangement.preGenerateOrchestra(mixer, nchnls, alwaysOnInstruments);

        boolean generateMixer = mixerEnabled && (hasInstruments || mixer.hasSubChannelDependencies());

        NoteList generatedNotes = null;

        for (Instrument instrument : alwaysOnInstruments) {
            int instrId = arrangement.addInstrumentAtEnd(instrument);
            globalSco += "i" + instrId + " 0 " + totalDur + "\n";
        }
        
        if (usingAPI) {
//            ArrayList parameters = ParameterHelper.getAllParameters(
//                    arrangement, mixer);
            generatedNotes = new NoteList();
            handleParametersForBlueLive(originalParameters, stringChannels, globalOrcSco,
                    generatedNotes, arrangement, usingAPI);

        }

        if (generateMixer) {

            clearUnusedMixerChannels(mixer, arrangement);

            globalOrcSco.appendGlobalOrc(mixer.getInitStatements(nchnls));
            int instrId = arrangement.addInstrumentAtEnd(mixer.getMixerInstrument(
                    udos, nchnls));

            globalSco += "i" + instrId + " 0 " + totalDur;

        }

        arrangement.addInstrument("blueAllNotesOff",
                createAllNotesOffInstrument(instrIds));

        String ftables = tables.getTables();
        
        StrBuilder score = new StrBuilder();
        score.append("<CsoundSynthesizer>\n\n");

        appendCsInstruments(data, udos, arrangement, globalOrcSco, score,
                mixer, true);
        appendCsScore(globalSco, ftables, generatedNotes, totalDur, score);

        score.append("</CsoundSynthesizer>");


//        Tempo tempo = data.getScore().getTempo();
        TempoMapper tempoMapper = null;

//        if (tempo.isEnabled()) {
//            tempoMapper = CSDRender.getTempoMapper(tempo);
//        } else {
//            tempoMapper = CSDRender.getTempoMapper(globalSco);
//        }
        
        CsdRenderResult renderResult =
                new CsdRenderResult(score.toString(), tempoMapper,
                originalParameters, stringChannels);


        return renderResult;
    }

    @Override
    protected CsdRenderResult generateCSDImpl(BlueData data,
            float startTime, float endTime, boolean isRealTime, boolean _usingAPI) {

        ArrayList<StringChannel> stringChannels = getStringChannels(data.getArrangement());
        
        ParameterHelper.clearCompilationVarNames(data);

        boolean usingAPI = isRealTime && _usingAPI;

        float renderStartTime = data.getRenderStartTime();

        // making copies to use for adding compileTime tables and instruments
        Tables tables = (Tables) data.getTableSet().clone();

        ArrayList originalParameters;

//        if (usingAPI) {
        originalParameters = ParameterHelper.getAllParameters(
                data.getArrangement(), data.getMixer());
//        } else {
//            originalParameters = ParameterHelper.getActiveParameters(
//                    data.getArrangement(), data.getMixer());
//        }


        assignParameterNames(originalParameters);

        Arrangement arrangement = (Arrangement) data.getArrangement().clone();
        arrangement.clearUnusedInstrAssignments();
        boolean hasInstruments = arrangement.size() > 0;

        Mixer mixer = null;
        boolean mixerEnabled = data.getMixer().isEnabled();

        if (mixerEnabled) {
            mixer = (Mixer) data.getMixer().clone();
        }

        // get parameters
        //ArrayList parameters;

//        if (usingAPI) {
//        parameters = ParameterHelper.getAllParameters(
//                arrangement, mixer);
//        } else {
//            parameters = ParameterHelper.getActiveParameters(
//                    arrangement, mixer);
//        }

        GlobalOrcSco globalOrcSco = (GlobalOrcSco) data.getGlobalOrcSco().clone();

        OpcodeList udos = (OpcodeList) ObjectUtilities.clone(
                data.getOpcodeList());

        // add all UDO's from instruments and effects
        arrangement.generateUserDefinedOpcodes(udos);

        // adding all compile-time instruments from soundObjects to arrangement
        appendFtgenTableNumbers(globalOrcSco.getGlobalOrc(), tables);

        // generating ftables
        arrangement.generateFTables(tables);
        
        CompileData compileData = new CompileData(arrangement, tables);
        NoteList generatedNotes;
        try {
            generatedNotes = data.getScore().generateForCSD(compileData, 
           startTime, endTime);
        } catch (ScoreGenerationException ex) {
            throw new RuntimeException(ex);    
        }
        
        String ftables = tables.getTables();
        
        // Handle Render End Instrument and Note
        if (endTime > 0.0f && endTime > startTime) {
            Instrument instr = createRenderEndInstrument();
            int instrId = arrangement.addInstrument(instr);

            float endStartTime = endTime - startTime;

            try {
                Note renderEndNote = Note.createNote(
                        "i" + instrId + " " + endStartTime + " 0.1");
                generatedNotes.addNote(renderEndNote);
            } catch (NoteParseException e1) {
            }
        }

        Tempo tempo = data.getScore().getTempo();
        TempoMapper tempoMapper = null;

        if (tempo.isEnabled()) {
            tempoMapper = getTempoMapper(tempo);
            globalOrcSco.appendGlobalSco(
                getTempoScore(tempo, renderStartTime, endTime));
        } else {
            tempoMapper = getTempoMapper(globalOrcSco.getGlobalSco());
        }

        float totalDur = blue.utility.ScoreUtilities.getTotalDuration(
                generatedNotes);

//        float processingStart = blue.utility.ScoreUtilities.getProcessingStartTime(
//                tempPObj);
        // FIXME - figure out what to do about PROCESSING_START
        float processingStart = renderStartTime;

        System.out.println("<TOTAL_DUR> = " + totalDur);
        System.out.println("<RENDER_START> = " + renderStartTime);
        System.out.println("<PROCESSING_START> = " + processingStart);

        String globalSco = globalOrcSco.getGlobalSco() + "\n";
        globalSco += arrangement.generateGlobalSco() + "\n";
        globalSco = preprocessSco(globalSco, totalDur, renderStartTime,
                processingStart, tempoMapper);

        float globalDur;
        try {
            globalDur = getGlobalDuration(globalSco);
        } catch (SoundObjectException ex) {
            throw new RuntimeException(ex);
        }

        if (globalDur < totalDur) {
            globalDur = totalDur;
        }

        System.out.println("Global Duration = " + globalDur);


        int nchnls = getNchnls(data, isRealTime);

        ArrayList<Instrument> alwaysOnInstruments = new ArrayList<Instrument>();

        arrangement.preGenerateOrchestra(mixer, nchnls, alwaysOnInstruments);

        boolean generateMixer = mixerEnabled && (hasInstruments || mixer.hasSubChannelDependencies());

        if (generateMixer) {
            globalDur += mixer.getExtraRenderTime();
        }

        for (Instrument instrument : alwaysOnInstruments) {
            int instrId = arrangement.addInstrumentAtEnd(instrument);

            try {
                Note n = Note.createNote("i" + instrId + " 0 " + globalDur);
                generatedNotes.addNote(n);
            } catch (NoteParseException ex) {
                ex.printStackTrace();
            }

        }

        if (generateMixer) {

            //globalDur += mixer.getExtraRenderTime();

            clearUnusedMixerChannels(mixer, arrangement);

            globalOrcSco.appendGlobalOrc(mixer.getInitStatements(nchnls) + "\n");

            int instrId = arrangement.addInstrumentAtEnd(mixer.getMixerInstrument(
                    udos, nchnls));

            try {
                Note n = Note.createNote("i" + instrId + " 0 " + globalDur);
                generatedNotes.addNote(n);
            } catch (NoteParseException ex) {
                ex.printStackTrace();
            }

        }

        handleParameters(originalParameters, stringChannels, globalOrcSco, generatedNotes,
                arrangement,
                startTime,
                startTime + globalDur, isRealTime, _usingAPI);


        if (isRealTime && !usingAPI) {
            Instrument instr = createBlueTimePointerInstrument();
            int instrId = arrangement.addInstrument(instr);

            try {
                Note n = Note.createNote("i" + instrId + " 0 " + globalDur);
                generatedNotes.addNote(n);
            } catch (NoteParseException ex) {
                ex.printStackTrace();
            }
        }

        StrBuilder csd = new StrBuilder();
        appendProjectInfo(data, csd);

        csd.append("<CsoundSynthesizer>\n\n");

        appendCsInstruments(data, udos, arrangement, globalOrcSco, csd, mixer,
                isRealTime);
        appendCsScore(globalSco, ftables, generatedNotes, totalDur, csd);

        csd.append("</CsoundSynthesizer>");


        CsdRenderResult renderResult =
                new CsdRenderResult(csd.toString(), tempoMapper,
                originalParameters, stringChannels);
        

        return renderResult;
    }

    private ArrayList<StringChannel> getStringChannels(Arrangement arrangement) {
        ArrayList<StringChannel> params = new ArrayList<StringChannel>();
        StringChannelNameManager scnm = new StringChannelNameManager();

        for (int i = 0; i < arrangement.size(); i++) {
            InstrumentAssignment ia = arrangement.getInstrumentAssignment(i);
            if (ia.enabled) {
                Instrument instr = ia.instr;

                if (instr instanceof Automatable) {
                    Automatable auto = (Automatable) instr;
                    ArrayList<StringChannel> stringChannels = auto.getStringChannels();
                   
                    if(stringChannels != null) {
                        params.addAll(stringChannels);
                    }
                    
                }

            }
        }
        
        for(StringChannel strChannel : params) {
            strChannel.setChannelName(scnm.getUniqueStringChannel());
        }

        return params;
    }
    
    private void clearUnusedMixerChannels(Mixer mixer,
            Arrangement arrangement) {

        ArrayList ids = new ArrayList();

        for (int i = 0; i < arrangement.getRowCount(); i++) {
            InstrumentAssignment ia = arrangement.getInstrumentAssignment(i);
            ids.add(ia.arrangementId);
        }


        ChannelList channelList = mixer.getChannels();
        channelList.clearChannelsNotInList(ids);
    }

    private void appendFtgenTableNumbers(String globalOrc, Tables tables) {
        Pattern p = Pattern.compile("ftgen\\s+-?(\\d+)");
        Matcher m = p.matcher(globalOrc);

        while (m.find()) {
            int ftgenNum = Integer.parseInt(m.group(1));
            if (ftgenNum != 0) {
                tables.addFtgenNumber(ftgenNum);
            }
        }
    }

    private void createParamNote(StrBuilder paramScore, int instrId,
            float startTime, float dur, float startVal, float endVal) {
        paramScore.append("i");
        paramScore.append(instrId).append("\t");
        paramScore.append(NumberUtilities.formatFloat(startTime)).append("\t");
        paramScore.append(NumberUtilities.formatFloat(dur)).append("\t");
        paramScore.append(NumberUtilities.formatFloat(startVal)).append("\t");
        paramScore.append(NumberUtilities.formatFloat(endVal)).append("\n");
    }

    /**
     * @param globalSco
     * @return
     * @throws SoundObjectException
     */
    private float getGlobalDuration(String globalSco)
            throws SoundObjectException {
        NoteList globalNotes;
        try {
            globalNotes = ScoreUtilities.getNotes(globalSco);
        } catch (NoteParseException e) {
            GenericScore gs = new GenericScore();
            gs.setName("Global Orchestra Text");
            throw new SoundObjectException(gs, e);
        }

        float globalDur = ScoreUtilities.getTotalDuration(globalNotes);
        return globalDur;
    }

    /**
     * @param data
     * @return
     */
    private int getNchnls(BlueData data, boolean isRealtime) {
        int nchnls = 2;

        try {
            ProjectProperties props = data.getProjectProperties();

            if (isRealtime) {
                nchnls = Integer.parseInt(props.channels.trim());
            } else {
                nchnls = Integer.parseInt(props.diskChannels.trim());
            }
        } catch (NumberFormatException nfe) {
        }
        return nchnls;
    }

    private Instrument createRenderEndInstrument() {
        GenericInstrument instr = new GenericInstrument();

        String instrText = "event \"e\", 0, 0, 0.1";

        instr.setText(instrText);

        return instr;
    }

    private Instrument createBlueTimePointerInstrument() {
        GenericInstrument instr = new GenericInstrument();

        int fps = PlaybackSettings.getInstance().getPlaybackFPS();
        float time = 1.0f / fps;

        String instrText = "ktime	times\n" + "printks \"blueTimePointer=%f\\\\n\", " + time + ", ktime";

        instr.setText(instrText);

        return instr;
    }

    protected Instrument createAllNotesOffInstrument(String[] instrIds) {
        GenericInstrument instr = new GenericInstrument();
        StrBuilder buffer = new StrBuilder();

        buffer.append("koff init 0\n"
                + "if (koff == 0) then\n");

        for (int i = 0; i < instrIds.length; i++) {
            String id = instrIds[i];
            String[] parts = StringUtils.split(id, ",");

            for (int j = 0; j < parts.length; j++) {
                String tempId = parts[j];
                try {
                    int instrIdNum = Integer.parseInt(tempId.trim());

                    buffer.append("turnoff2 ").append(instrIdNum);
                    buffer.append(", 0, 1\n");
                } catch (NumberFormatException nfe) {
                    buffer.append("insno").append(i).append(j);
                    buffer.append(" nstrnum \"").append(tempId).append("\"\n");
                    buffer.append("turnoff2 insno").append(i).append(j);
                    buffer.append(", 0, 1\n");
                }
            }
        }

        buffer.append("koff = 1\nelse\nturnoff\nendif\n");
        instr.setText(buffer.toString());

        return instr;
    }

    private void appendProjectInfo(BlueData data, StrBuilder score) {
        ProjectProperties props = data.getProjectProperties();
        String notes = props.notes.replaceAll("\n", "\n; ");

        score.append(";\n");
        score.append("; \"").append(props.title).append("\"\n");
        score.append("; by ").append(props.author).append("\n");
        score.append(";\n");
        score.append("; ").append(notes).append("\n");
        score.append(";\n");
        score.append("; Generated by blue ").append(BlueConstants.getVersion()).
                append(" (http://blue.kunstmusik.com)\n");
        score.append(";\n\n");
    }

    private void appendCsScore(String globalSco, String ftables,
            NoteList generatedNotes, float totalDur, StrBuilder score) {

        score.append("<CsScore>\n\n");
        score.append(ftables).append("\n");
        score.append("\n");

        score.append(globalSco).append("\n\n");

        if (generatedNotes != null) {
            score.append(generatedNotes.toString()).append("\n");
        } else {
            score.append("f0 ").append(totalDur).append("\n");
        }
        score.append("e\n\n");
        score.append("</CsScore>\n\n");
    }

    private void appendCsInstruments(BlueData data, OpcodeList udos,
            Arrangement arrangement, GlobalOrcSco globalOrcSco,
            StrBuilder score, Mixer mixer, boolean isRealTime) {

        ProjectProperties projProps = data.getProjectProperties();

        score.append("<CsInstruments>\n");

        int nchnls = 2;

        if (isRealTime) {
            try {
                nchnls = Integer.parseInt(projProps.channels.trim());
            } catch (NumberFormatException nfe) {
                System.err.println("Could not parse nchnls: defaulting to 2");
            }

            score.append("sr=").append(projProps.sampleRate).append("\n");
            score.append("ksmps=").append(projProps.getKsmps()).append("\n");
            score.append("nchnls=").append(nchnls).append("\n");

            if (projProps.useZeroDbFS) {
                score.append("0dbfs=").append(projProps.zeroDbFS).append("\n");
            }

        } else {

            try {
                nchnls = Integer.parseInt(projProps.diskChannels.trim());
            } catch (NumberFormatException nfe) {
                System.err.println("Could not parse nchnls: defaulting to 2");
            }

            score.append("sr=").append(projProps.diskSampleRate).append("\n");
            score.append("ksmps=").append(projProps.diskKsmps).append("\n");
            score.append("nchnls=").append(nchnls).append("\n");

            if (projProps.diskUseZeroDbFS) {
                score.append("0dbfs=").append(projProps.diskZeroDbFS).append(
                        "\n");
            }
        }

        score.append("\n");
        score.append(globalOrcSco.getGlobalOrc()).append("\n");
        score.append("\n");
        score.append(
                CommandProcessor.processCommandBlocks(
                arrangement.generateGlobalOrc())).append("\n");
        score.append("\n");
        score.append(udos.toString()).append("\n");
        score.append("\n");
        score.append(arrangement.generateOrchestra(mixer, nchnls));
        score.append("\n");
        score.append("</CsInstruments>\n\n");
    }

    private String preprocessSco(String in, float totalDur,
            float renderStartTime, float processingStart,
            TempoMapper tempoMapper) {
        String temp = blue.utility.TextUtilities.replaceAll(in, "<TOTAL_DUR>",
                Float.toString(totalDur));

        temp = blue.utility.TextUtilities.replaceAll(temp,
                "<PROCESSING_START>", Float.toString(processingStart));

        temp = blue.utility.TextUtilities.replaceAll(temp, "<RENDER_START>",
                Float.toString(renderStartTime));

        TempoMapper localTempoMapper = tempoMapper;

        if (localTempoMapper == null) {
            localTempoMapper = getTempoMapper(in);
        }

        if (tempoMapper != null) {
            temp = blue.utility.TextUtilities.replaceAll(temp,
                    "<RENDER_START_ABSOLUTE>",
                    Float.toString(tempoMapper.beatsToSeconds(renderStartTime)));
        } else {
            temp = blue.utility.TextUtilities.replaceAll(temp,
                    "<RENDER_START_ABSOLUTE>",
                    Float.toString(renderStartTime));
        }

        return temp;
    }

    private GenericInstrument getParameterInstrument(Parameter param) {
        GenericInstrument instr = new GenericInstrument();
        instr.setName("Param: " + param.getName());

        StrBuilder buffer = new StrBuilder();
        String compilationVarName = param.getCompilationVarName();



        if (param.getResolution() > 0.0f) {
            buffer.append(compilationVarName);
            buffer.append(" init p4\nturnoff");
        } else {
            buffer.append("if (p4 == p5) then\n");
            buffer.append(compilationVarName);
            buffer.append(" init p4\nturnoff\nelse\n");
            buffer.append(compilationVarName);
            buffer.append(" line p4, p3, p5\nendif");
        }

        instr.setText(buffer.toString());

        return instr;
    }

    private void appendParameterScore(Parameter param, int instrId,
            StrBuilder paramScore, float renderStart, float renderEnd) {

        Line line = param.getLine();

        if (line.size() < 2) {
            return;
        }

        float resolution = param.getResolution();

        if (resolution > 0.0f) {
            for (int i = 1; i < line.size(); i++) {
                LinePoint p1 = line.getLinePoint(i - 1);
                LinePoint p2 = line.getLinePoint(i);

                float startTime = p1.getX();
                float endTime = p2.getX();

                if (renderEnd > 0 && startTime >= renderEnd) {
                    return;
                }

                if (endTime <= renderStart) {
                    continue;
                }

                float startVal = p1.getY();
                float endVal = p2.getY();

                // to skip points that don't contribute to end value
                if (startTime == endTime) {
                    if (i == line.size() - 1) {
                        createParamNote(paramScore, instrId,
                                endTime, .0001f, p2.getY(), p2.getY());
                    }
                    continue;
                }

                if (startVal == endVal) {
                    continue;
                }

                float dur = endTime - startTime;

                float currentVal = startVal;

                int numSteps = Math.abs(Math.round(
                        (endVal - startVal) / resolution));

                float step = dur / numSteps;

                float start = startTime;

                float valStep = resolution;

                if (endVal < startVal) {
                    valStep = -valStep;
                }

                // skip the first value as it will be already defined
                for (int j = 0; j < numSteps - 1; j++) {

                    currentVal += valStep;
                    start += step;

                    if (start <= renderStart) {
                        continue;
                    }

                    if (renderEnd > 0 && start >= renderEnd) {
                        return;
                    }

                    paramScore.append("i");
                    paramScore.append(instrId).append("\t");
                    paramScore.append(
                            NumberUtilities.formatFloat(start - renderStart)).
                            append("\t");
                    paramScore.append(".0001\t");
                    paramScore.append(NumberUtilities.formatFloat(currentVal)).
                            append("\n");
                }

                start += step;

                if (renderEnd > 0 && start >= renderEnd) {
                    return;
                }

                paramScore.append("i");
                paramScore.append(instrId).append("\t");
                paramScore.append(
                        NumberUtilities.formatFloat(start - renderStart)).append(
                        "\t");
                paramScore.append(".0001\t");
                paramScore.append(NumberUtilities.formatFloat(endVal)).append(
                        "\n");

            }

        } else {
            float lastValue = line.getLinePoint(0).getY();

            for (int i = 1; i < line.size(); i++) {
                LinePoint p1 = line.getLinePoint(i - 1);
                LinePoint p2 = line.getLinePoint(i);

                float startTime = p1.getX();
                float endTime = p2.getX();

                if (renderEnd > 0 && startTime >= renderEnd) {
                    return;
                }

                if (endTime <= renderStart) {
                    lastValue = p2.getY();
                    continue;
                }

                if (p1.getX() == p2.getX()) {
                    if (i == line.size() - 1) {
                        createParamNote(paramScore, instrId,
                                p2.getX(), .0001f, p2.getY(), p2.getY());
                    }

                    continue;
                }

//                if (p1.getY() == p2.getY() && p1.getY() == lastValue) {
//                    continue;
//                }

                float startVal = p1.getY();
                float endVal = p2.getY();

                if (startTime < renderStart) {
                    startVal = line.getValue(renderStart);
                    startTime = renderStart;
                }

                if (renderEnd > 0 && endTime > renderEnd) {
                    endVal = line.getValue(renderEnd);
                    endTime = renderEnd;
                }

                lastValue = endVal;

                float dur;

                if (p1.getY() == p2.getY()) {
                    dur = .0001f;
                } else {
                    dur = endTime - startTime;
                }

                startTime -= renderStart;

                createParamNote(paramScore, instrId, startTime, dur, startVal,
                        endVal);

                if (i == line.size() - 1) {
                    createParamNote(paramScore, instrId, startTime + dur,
                            .0001f, endVal, endVal);
                }
            }
        }

    }

    protected String getTempoScore(Tempo tempo, float renderStart,
            float renderEnd) {

        Line line = tempo.getLine();

        if (line.size() == 1) {
            return "t 0 " + line.getLinePoint(0).getY();
        }

        if (renderStart > line.getLinePoint(line.size() - 1).getX()) {
            return "t 0 " + line.getLinePoint(line.size() - 1).getY();
        }

        StrBuilder buffer = new StrBuilder();
        buffer.append("t 0 ").append(line.getValue(renderStart));

        for (int i = 0; i < line.size(); i++) {
            LinePoint lp = line.getLinePoint(i);
            float pointBeat = lp.getX();
            if (pointBeat > renderStart) {
                if (renderEnd < 0 || pointBeat < renderEnd) {
                    buffer.append(" ").append(pointBeat - renderStart);
                    buffer.append(" ").append(lp.getY());
                } else {
                    break;
                }
            }
        }

        if (renderEnd > 0) {
            buffer.append(" ").append(renderEnd - renderStart);
            buffer.append(" ").append(line.getValue(renderEnd));
        }

        buffer.append("\n");

        return buffer.toString();
    }

    private void assignParameterNames(ArrayList parameters) {
        Object[] varNum = new Object[1];

        for (int i = 0; i < parameters.size(); i++) {
            Parameter param = (Parameter) parameters.get(i);
            varNum[0] = new Integer(i);
            String varName = PARAM_VAR_NAME.format(varNum);

            param.setCompilationVarName(varName);
        }
    }

    private void handleParameters(ArrayList parameters,
            ArrayList<StringChannel> stringChannels,
            GlobalOrcSco globalOrcSco, NoteList notes, Arrangement arrangement,
            float startTime, float endTime, boolean isRealTime, boolean _usingAPI) {

        Object[] varNum = new Object[1];

        StrBuilder initStatements = new StrBuilder();
        StrBuilder paramScore = new StrBuilder();

        boolean useAPI = isRealTime && _usingAPI;

        for(StringChannel strChannel : stringChannels) {
            String varName = strChannel.getChannelName();
            
            initStatements.append(varName);
            initStatements.append(" = ");
            initStatements.append("\"").append(strChannel.getValue()).append("\"\n");
            
            if (useAPI) {
                initStatements.append(varName).append(" chnexport \"");
                initStatements.append(varName).append("\", 3\n");
            } 
        }
        
        for (int i = 0; i < parameters.size(); i++) {
            Parameter param = (Parameter) parameters.get(i);
            varNum[0] = new Integer(i);
            String varName = param.getCompilationVarName();

            //param.setCompilationVarName(varName);

            float initialVal;

            if (param.isAutomationEnabled()) {

                initialVal = param.getLine().getValue(startTime);

                float resolution = param.getResolution();

                if (resolution > 0.0f) {
                    initialVal = param.getResolutionAdjustedValue(initialVal);
                }

            } else {
                initialVal = param.getFixedValue();
            }

            
            // init statements
                initStatements.append(varName);
                initStatements.append(" init ");
                initStatements.append(NumberUtilities.formatFloat(initialVal));
                initStatements.append("\n");

            if (useAPI) {
                initStatements.append(varName).append(" chnexport \"");
                initStatements.append(varName).append("\", 3\n");
            } else if (param.isAutomationEnabled()) {
                // gk instrument
                GenericInstrument instr = getParameterInstrument(param);
                int instrId = arrangement.addInstrumentAtEnd(instr);

                // score for values
                appendParameterScore(param, instrId, paramScore, startTime,
                        endTime);
            }
        }

        globalOrcSco.appendGlobalOrc(initStatements.toString());
        try {

            notes.addAll(ScoreUtilities.getNotes(paramScore.toString()));

        } catch (NoteParseException ex) {
            ex.printStackTrace();
        }

//        globalOrcSco.appendGlobalSco(paramScore.toString());

    }

    private void handleParametersForBlueLive(ArrayList parameters,
            ArrayList<StringChannel> stringChannels,
            GlobalOrcSco globalOrcSco, NoteList notes, Arrangement arrangement,
            boolean useAPI) {

        Object[] varNum = new Object[1];

        StrBuilder initStatements = new StrBuilder();
        StrBuilder paramScore = new StrBuilder();

        for(StringChannel strChannel : stringChannels) {
            String varName = strChannel.getChannelName();
            
            initStatements.append(varName);
            initStatements.append(" = ");
            initStatements.append("\"").append(strChannel.getValue()).append("\"\n");

            if (useAPI) {
                initStatements.append(varName).append(" chnexport \"");
                initStatements.append(varName).append("\", 3\n");            
            } 
        }
        
        for (int i = 0; i < parameters.size(); i++) {
            Parameter param = (Parameter) parameters.get(i);
            varNum[0] = new Integer(i);
            String varName = param.getCompilationVarName();

            //param.setCompilationVarName(varName);

            float initialVal = param.getFixedValue();

            float resolution = param.getResolution();

            if (resolution > 0.0f) {

                initialVal = param.getResolutionAdjustedValue(initialVal);
            }

            // init statements
            initStatements.append(varName);
            initStatements.append(" init ");
            initStatements.append(NumberUtilities.formatFloat(initialVal));
            initStatements.append("\n");

            if(useAPI) {
                initStatements.append(varName).append(" chnexport \"");
                initStatements.append(varName).append("\", 3\n");
            }
        }

        globalOrcSco.appendGlobalOrc(initStatements.toString());
        try {
            notes.addAll(ScoreUtilities.getNotes(paramScore.toString()));
        } catch (NoteParseException ex) {
            ex.printStackTrace();
        }

//        globalOrcSco.appendGlobalSco(paramScore.toString());

    }

    protected TempoMapper getTempoMapper(Tempo tempo) {
        StrBuilder buffer = new StrBuilder();
        Line line = tempo.getLine();
        for (int i = 0; i < line.size(); i++) {
            LinePoint lp = line.getLinePoint(i);

            buffer.append(" ").append(lp.getX());
            buffer.append(" ").append(lp.getY());
        }

        return TempoMapper.createTempoMapper(buffer.toString());
    }

    private TempoMapper getTempoMapper(String globalSco) {
        TempoMapper mapper = null;

        StringTokenizer st = new StringTokenizer(globalSco, "\n");

        while (st.hasMoreTokens()) {
            String temp = st.nextToken().trim();

            if (temp.startsWith("t")) {
                mapper = TempoMapper.createTempoMapper(temp.substring(1));
            }

        }

        return mapper;
    }
}