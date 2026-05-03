package blue.ui.core;

import blue.BlueData;
import blue.mixer.ChannelList;
import blue.orchestra.GenericInstrument;
import blue.projects.BlueProject;
import java.io.File;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ArrangementProjectListenerTest {

    @Test
    void keepsMixerChannelsInSyncWhenArrangementChangesWithoutUiPanels() {
        BlueData data = new BlueData();
        BlueProject project = new BlueProject(data, (File) null);
        ArrangementProjectListener listener = new ArrangementProjectListener();

        listener.setCurrentProject(project);
        data.getArrangement().addInstrumentWithId(new GenericInstrument(), "1");
        data.getArrangement().addInstrumentWithId(new GenericInstrument(), "2");
        data.getArrangement().removeInstrument("1");

        ChannelList channels = data.getMixer().getChannels();

        assertEquals(1, channels.size());
        assertEquals("2", channels.get(0).getName());
    }

    @Test
    void renamingInstrumentIdDoesNotCreateDuplicateMixerChannels() {
        BlueData data = new BlueData();
        BlueProject project = new BlueProject(data, (File) null);
        ArrangementProjectListener listener = new ArrangementProjectListener();

        listener.setCurrentProject(project);

        GenericInstrument first = new GenericInstrument();
        GenericInstrument second = new GenericInstrument();

        data.getArrangement().addInstrumentWithId(first, "1");
        data.getArrangement().addInstrumentWithId(second, "3");
        data.getArrangement().changeInstrumentId(second, "2");

        ChannelList channels = data.getMixer().getChannels();

        assertEquals(2, channels.size());
        assertEquals("1", channels.get(0).getName());
        assertEquals("2", channels.get(1).getName());
    }

    @Test
    void rebindsToReplacementArrangementWhenProjectDataIsReplacedInPlace() {
        BlueData originalData = new BlueData();
        BlueProject project = new BlueProject(originalData, (File) null);
        ArrangementProjectListener listener = new ArrangementProjectListener();

        listener.setCurrentProject(project);
        originalData.getArrangement().addInstrumentWithId(new GenericInstrument(), "1");

        BlueData replacementData = new BlueData();
        replacementData.getArrangement().addInstrumentWithId(new GenericInstrument(), "2");

        project.setData(replacementData);
        listener.setCurrentProject(project);

        replacementData.getArrangement().addInstrumentWithId(
                new GenericInstrument(), "3");

        ChannelList channels = replacementData.getMixer().getChannels();

        assertEquals(2, channels.size());
        assertEquals("2", channels.get(0).getName());
        assertEquals("3", channels.get(1).getName());
    }
}
