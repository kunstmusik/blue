package blue.ui.core.mixer;

import blue.Arrangement;
import blue.mixer.Channel;
import blue.mixer.Mixer;
import blue.orchestra.GenericInstrument;
import java.awt.Component;
import java.io.File;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.TimeUnit;
import javax.swing.SwingUtilities;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;
import blue.ui.utilities.FileChooserManager;

@Execution(ExecutionMode.SAME_THREAD)
class MixerTopComponentTest {

    private static Object originalFileChooserManager;

    @BeforeAll
    static void installNoOpFileChooserManager() throws Exception {
        System.setProperty("java.awt.headless", "true");

        Field instanceField = FileChooserManager.class.getDeclaredField("instance");
        instanceField.setAccessible(true);
        originalFileChooserManager = instanceField.get(null);
        instanceField.set(null, new NoOpFileChooserManager());
    }

    @AfterAll
    static void restoreFileChooserManager() throws Exception {
        Field instanceField = FileChooserManager.class.getDeclaredField("instance");
        instanceField.setAccessible(true);
        instanceField.set(null, originalFileChooserManager);
    }

    @Test
    void keepsChannelPanelInSyncWhenArrangementChangesOffEdt() throws Exception {
        MixerTopComponent topComponent = newMixerTopComponent();
        Mixer mixer = new Mixer();
        Arrangement arrangement = new Arrangement();

        GenericInstrument first = new GenericInstrument();
        GenericInstrument second = new GenericInstrument();
        GenericInstrument third = new GenericInstrument();

        arrangement.addInstrumentWithId(first, "1");
        arrangement.addInstrumentWithId(second, "2");
        arrangement.addInstrumentWithId(third, "3");

        runOnEdt(() -> topComponent.setMixer(mixer));
        runOnEdt(() -> topComponent.setArrangement(arrangement));

        ChannelListPanel channelsPanel = getChannelListPanel(topComponent);
        awaitChannelNames(channelsPanel, "1", "2", "3");

        runOffEdt(() -> arrangement.changeInstrumentId(third, "2"));
        awaitChannelNames(channelsPanel, "1", "2");

        runOffEdt(() -> arrangement.changeInstrumentId(third, "3"));
        awaitChannelNames(channelsPanel, "1", "2", "3");

        runOffEdt(() -> arrangement.removeInstrument("2"));
        awaitChannelNames(channelsPanel, "1", "3");
    }

    private static MixerTopComponent newMixerTopComponent() throws Exception {
        AtomicReference<MixerTopComponent> reference = new AtomicReference<>();
        runOnEdt(() -> reference.set(createMixerTopComponent()));
        return reference.get();
    }

    private static MixerTopComponent createMixerTopComponent() throws Exception {
        Constructor<MixerTopComponent> ctor = MixerTopComponent.class
                .getDeclaredConstructor();
        ctor.setAccessible(true);
        return ctor.newInstance();
    }

    private static ChannelListPanel getChannelListPanel(MixerTopComponent topComponent)
            throws Exception {
        Field channelsField = MixerTopComponent.class.getDeclaredField("channelsPanel");
        channelsField.setAccessible(true);
        return (ChannelListPanel) channelsField.get(topComponent);
    }

    private static void awaitChannelNames(ChannelListPanel channelsPanel,
            String... expectedNames) throws Exception {
        List<String> expected = List.of(expectedNames);
        List<String> actualNames = List.of();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);

        while (System.nanoTime() < deadline) {
            actualNames = snapshotChannelNames(channelsPanel);

            if (actualNames.equals(expected)) {
                return;
            }

            flushEdt();
        }

        assertEquals(expected, actualNames);
    }

    private static List<String> snapshotChannelNames(ChannelListPanel channelsPanel)
            throws Exception {
        AtomicReference<List<String>> reference = new AtomicReference<>();

        runOnEdt(() -> {
            List<String> actualNames = new ArrayList<>();

            for (int i = 0; i < channelsPanel.getComponentCount(); i++) {
                Component component = channelsPanel.getComponent(i);
                actualNames.add(((ChannelPanel) component).getChannel().getName());
            }

            reference.set(actualNames);
        });

        return reference.get();
    }

    private static void flushEdt() throws Exception {
        SwingUtilities.invokeAndWait(() -> {
        });
        SwingUtilities.invokeAndWait(() -> {
        });
    }

    private static void runOnEdt(ThrowingRunnable action) throws Exception {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        SwingUtilities.invokeAndWait(() -> {
            try {
                action.run();
            } catch (Throwable ex) {
                failure.set(ex);
            }
        });

        if (failure.get() != null) {
            Throwable throwable = failure.get();
            if (throwable instanceof Exception exception) {
                throw exception;
            }
            fail(throwable);
        }
    }

    private static void runOffEdt(ThrowingRunnable action) throws Exception {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread thread = new Thread(() -> {
            try {
                action.run();
            } catch (Throwable ex) {
                failure.set(ex);
            }
        });
        thread.start();
        thread.join();

        if (failure.get() != null) {
            Throwable throwable = failure.get();
            if (throwable instanceof Exception exception) {
                throw exception;
            }
            fail(throwable);
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private static final class NoOpFileChooserManager extends FileChooserManager {

        @Override
        public void addFilter(Object fileChooserId,
                javax.swing.filechooser.FileFilter filter) {
        }

        @Override
        public void setSelectedFile(Object fileChooserId, File f) {
        }

        @Override
        public void setCurrentDirectory(Object fileChooserId, File f) {
        }

        @Override
        public void setDialogTitle(Object fileChooserId, String title) {
        }

        @Override
        public void setMultiSelectionEnabled(Object fileChooserId, boolean val) {
        }

        @Override
        public void setDirectoryChooser(Object fileChooserId, boolean isDirectoriesOnly) {
        }

        @Override
        public List<File> showOpenDialog(Object fileChooserId, Component parent) {
            return List.of();
        }

        @Override
        public File showSaveDialog(Object fileChooserId, Component parent) {
            return null;
        }
    }
}
