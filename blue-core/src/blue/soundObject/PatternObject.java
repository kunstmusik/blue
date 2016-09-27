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
package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.plugin.SoundObjectPlugin;
import blue.soundObject.pattern.Pattern;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Map;
import java.util.Vector;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import javax.swing.table.TableModel;

/**
 * @author Steven Yi
 */
@SoundObjectPlugin(displayName = "PatternObject", live = true, position = 80)
public class PatternObject extends AbstractSoundObject implements TableModel,
        GenericViewable {

//    private static BarRenderer renderer = new GenericRenderer();
    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    double repeatPoint = -1.0f;

    private int beats = 4;

    private int subDivisions = 4;

    private transient Vector listeners = null;

    private transient Vector pListeners = null;

    private ArrayList<Pattern> patterns = new ArrayList<>();

    public PatternObject() {
        this.setName("Pattern");
        this.timeBehavior = TIME_BEHAVIOR_SCALE;
    }

    public PatternObject(PatternObject pObj) {
        super(pObj);

        npc = new NoteProcessorChain(pObj.npc);
        timeBehavior = pObj.timeBehavior;
        repeatPoint = pObj.repeatPoint;
        beats = pObj.beats;
        subDivisions = pObj.subDivisions;

        for (Pattern p : pObj.patterns) {
            patterns.add(new Pattern(p));
        }
    }

    public void addPattern(int index) {
        Pattern pattern = new Pattern(beats * subDivisions);
        pattern.setPatternName(pattern.getPatternName() + patterns.size());

        patterns.add(index, pattern);

        fireTableDataChanged();
    }

    /**
     * Used only during deserialization
     */
    private void addPattern(Pattern p) {
        patterns.add(p);
    }

    public void removePattern(int index) {
        patterns.remove(index);

        fireTableDataChanged();
    }

    public void pushUpPatternLayers(int[] rows) {
        Pattern a = patterns.remove(rows[0] - 1);
        patterns.add(rows[rows.length - 1], a);
        this.fireTableDataChanged();

    }

    public void pushDownPatternLayers(int[] rows) {
        Pattern a = patterns.remove(rows[rows.length - 1] + 1);
        patterns.add(rows[0], a);
        this.fireTableDataChanged();

    }

    public int size() {
        return patterns.size();
    }

    public Pattern getPattern(int index) {
        return (Pattern) patterns.get(index);
    }

    /* COMPILATION METHODS */
    public NoteList generateNotes(double renderStart, double renderEnd) throws SoundObjectException {
        NoteList tempNoteList = new NoteList();

        // check if solo is selected, if so, return only that layer's notes if
        // not muted
        boolean soloFound = false;

        double timeIncrement = 1.0f / this.subDivisions;

        for (int i = 0; i < this.size(); i++) {
            Pattern p = this.getPattern(i);

            if (p.isSolo() && !p.isMuted()) {

                soloFound = true;

                boolean[] tempPatternArray = p.values;

                for (int j = 0; j < tempPatternArray.length; j++) {

                    if (tempPatternArray[j]) {
                        NoteList tempPattern;

                        try {
                            tempPattern = ScoreUtilities.getNotes(p
                                    .getPatternScore());
                        } catch (NoteParseException e) {
                            throw new SoundObjectException(this, e);
                        }

                        double start = (j * timeIncrement);

                        ScoreUtilities.setScoreStart(tempPattern, start);

                        tempNoteList.merge(tempPattern);
                    }
                }
            }

        }

        if (!soloFound) {

            for (int i = 0; i < this.size(); i++) {
                Pattern p = this.getPattern(i);

                if (!p.isMuted()) {
                    boolean[] tempPatternArray = p.values;

                    for (int j = 0; j < tempPatternArray.length; j++) {
                        if (tempPatternArray[j]) {
                            NoteList tempPattern;

                            try {
                                tempPattern = ScoreUtilities.getNotes(p
                                        .getPatternScore());
                            } catch (NoteParseException e) {
                                throw new SoundObjectException(this, e);
                            }

                            double start = (j * timeIncrement);

                            ScoreUtilities.setScoreStart(tempPattern, start);

                            tempNoteList.merge(tempPattern);
                        }
                    }
                }

            }
        }

        try {
            ScoreUtilities.applyNoteProcessorChain(tempNoteList, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
        }

        ScoreUtilities.applyTimeBehavior(tempNoteList, this.getTimeBehavior(),
                this.getSubjectiveDuration(), this.getRepeatPoint(), beats);

        ScoreUtilities.setScoreStart(tempNoteList, startTime);

        return tempNoteList;
    }

    @Override
    public double getObjectiveDuration() {
        return getSubjectiveDuration();
    }

    @Override
    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    @Override
    public int getTimeBehavior() {
        return timeBehavior;
    }

    @Override
    public void setTimeBehavior(int timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    @Override
    public double getRepeatPoint() {
        return this.repeatPoint;
    }

    @Override
    public void setRepeatPoint(double repeatPoint) {
        this.repeatPoint = repeatPoint;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.REPEAT_POINT);

        fireScoreObjectEvent(event);
    }

    @Override
    public void setNoteProcessorChain(NoteProcessorChain chain) {
        this.npc = chain;
    }

    /* SERIALIZATION */
    public static SoundObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {

        PatternObject pattern = new PatternObject();
        SoundObjectUtilities.initBasicFromXML(data, pattern);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            String nodeName = node.getName();
            switch (nodeName) {
                case "beats":
                    pattern.setBeats(Integer.parseInt(node.getTextString()));
                    break;
                case "subDivisions":
                    pattern.setSubDivisions(Integer.parseInt(node.getTextString()));
                    break;
                case "patterns":
                    Elements patternNodes = node.getElements();
                    while (patternNodes.hasMoreElements()) {
                        Pattern p = Pattern.loadFromXML(patternNodes.next());
                        pattern.addPattern(p);
                    }
                    break;
            }

        }

        return pattern;
    }

    @Override
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("beats").setText(Integer.toString(beats));
        retVal.addElement("subDivisions").setText(
                Integer.toString(subDivisions));

        Element patternsNode = new Element("patterns");

        retVal.addElement(patternsNode);

        for (Iterator iter = patterns.iterator(); iter.hasNext();) {
            Pattern element = (Pattern) iter.next();
            patternsNode.addElement(element.saveAsXML());
        }

        return retVal;
    }

    /* GETTER/SETTER METHODS */
    public int getBeats() {
        return beats;
    }

    public void setBeats(int bars) {
        this.beats = bars;
    }

    public int getSubDivisions() {
        return subDivisions;
    }

    public void setSubDivisions(int subDivisions) {
        this.subDivisions = subDivisions;
    }

    public void setTime(int beats, int subDivisions) {

        if (this.beats == beats && this.subDivisions == subDivisions) {
            return;
        }

        this.beats = beats;
        this.subDivisions = subDivisions;

        int numBeats = beats * subDivisions;

        for (Iterator iter = patterns.iterator(); iter.hasNext();) {
            Pattern p = (Pattern) iter.next();

            p.values = new boolean[numBeats];

            for (int i = 0; i < p.values.length; i++) {
                p.values[i] = false;
            }
        }

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "time", null,
                null);

        firePropertyChangeEvent(pce);
    }

    /* TABLE MODEL METHODS */
    @Override
    public int getRowCount() {
        return patterns.size();
    }

    @Override
    public int getColumnCount() {
        return 2;
    }

    @Override
    public String getColumnName(int columnIndex) {
        switch (columnIndex) {
            case 0:
                return "Pattern Name";
            case 1:
                return "[x]";
            default:
                return "Error";
        }
    }

    @Override
    public Class getColumnClass(int columnIndex) {
        switch (columnIndex) {
            case 0:
                return String.class;
            case 1:
                return Boolean.class;
            default:
                return Object.class;
        }
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return true;
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        Pattern p = (Pattern) patterns.get(rowIndex);

        switch (columnIndex) {
            case 0:
                return p.getPatternName();
            case 1:
                return Boolean.valueOf(p.isMuted());
            default:
                return null;
        }
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
        Pattern p = (Pattern) patterns.get(rowIndex);

        switch (columnIndex) {
            case 0:
                p.setPatternName(aValue.toString());
                break;
            case 1:
                p.setMuted(((Boolean) aValue).booleanValue());
                break;
            default:
                throw new RuntimeException("Error: columnIndex " + columnIndex
                        + " not supported");
        }
    }

    @Override
    public void addTableModelListener(TableModelListener l) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(l);
    }

    @Override
    public void removeTableModelListener(TableModelListener l) {
        if (listeners == null) {
            return;
        }
        listeners.remove(l);
    }

    private void fireTableDataChanged() {
        if (listeners == null) {
            return;
        }

        TableModelEvent tme = new TableModelEvent(this);

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            TableModelListener listener = (TableModelListener) iter.next();
            listener.tableChanged(tme);
        }
    }

    /* PROPERTY CHANGE LISTENER CODE */
    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (pListeners == null) {
            return;
        }

        for (Iterator iter = pListeners.iterator(); iter.hasNext();) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();

            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (pListeners == null) {
            pListeners = new Vector();
        }
        pListeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (pListeners == null) {
            return;
        }
        pListeners.remove(pcl);
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, double startTime,
            double endTime) throws SoundObjectException {

        return generateNotes(startTime, endTime);

    }

    @Override
    public PatternObject deepCopy() {
        return new PatternObject(this);
    }

}
